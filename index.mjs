/**
 * dsh-plugin-attune — host half.
 *
 * A Cordis plugin (loaded as an out-of-tree bundle row, see cordis.patch.yml)
 * that puts the WeChat agent console into the DSH web GUI, in either of two
 * modes:
 *
 *   remote — `remote_url` names a console that is already running elsewhere
 *            (the Linux VM). The plugin owns no process; it proxies that
 *            machine's JSON API and reports its state, so the host DSH reads
 *            the real VM instead of a local stand-in.
 *   local  — the historical behaviour: `python -m wechat_agent desktop` is
 *            spawned on `desktop_host:desktop_port` and reaped on dispose.
 *
 * In both modes:
 *
 *   1. Proxies the Python console's JSON API under same-origin `/wechat/api/*`
 *      (GET/POST → `<console>/api/*`). The browser half fetches those routes;
 *      the console server itself never leaves loopback (or the VM's loopback).
 *   2. Serves `/wechat/health`, a compact probe (mode, target, latency, phase,
 *      thread_alive) that always answers 200 so a host can render state even
 *      when the VM is off.
 *
 * `webServer` is a hard injection: Cordis waits for the host HTTP server before
 * running this plugin (rows mount concurrently, so a bare `ctx.get` would race).
 * A profile that never provides one keeps the fiber pending; `apply` also
 * guards a direct call with no server, so it registers nothing, starts no
 * console and throws nothing.
 *
 * The console route table and payload shapes live in
 * `src/wechat_agent/desktop.py` and `src/wechat_agent/web/views.py`; this file
 * never duplicates them.
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { connect } from 'node:net';
import { homedir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import z from '@deepseek-ai/schemastery';

import { createSetupService } from './lib/setup.mjs';

/** Cordis plugin name; the bundle row id lives in cordis.patch.yml. */
export const name = 'attune';

/**
 * Hard-depend on the host webserver so Cordis waits for it to mount before
 * running this plugin. Reading `ctx.get('webServer')` at mount time is racy:
 * bundle rows mount concurrently and the HTTP server may not exist yet, which
 * would silently skip route registration. If a profile really has no webserver
 * the fiber simply stays pending; nothing throws.
 */
export const inject = ['webServer'];

/** Same-origin namespace owned by this plugin. */
const BASE = '/wechat';
/** The proxied subtree: `/wechat/api/<path>` → `/api/<path>`. */
const API_PREFIX = `${BASE}/api`;
/** One-click setup/connect/deploy routes owned by the host half. */
const SETUP_PREFIX = `${BASE}/setup`;
/** Compact upstream health probe; the DSH host and the panel both read it. */
const HEALTH_PATH = `${BASE}/health`;
/** Console upstream timeout. Panels only read small JSON documents. */
const UPSTREAM_TIMEOUT_MS = 30_000;
/** Health must answer even when the VM is off, so it gives up early. */
const HEALTH_TIMEOUT_MS = 5_000;
/** Same ceiling as `DesktopRequestHandler._read_json_body` (1 MB). */
const MAX_BODY_BYTES = 1_000_000;
/**
 * Persona uploads carry a whole folder of Markdown/JSON as one JSON body; the
 * console accepts up to 12 MB for this one route (see `persona_upload.py`), and
 * a 5 MB of text JSON plus base-less UTF-8 overhead stays well inside it.
 */
const PERSONA_UPLOAD_MAX_BODY_BYTES = 12_000_000;

/**
 * Voice reference audio travels as base64 JSON. The console caps the decoded
 * sample at 10 MB, so this hop needs the same 16 MB ceiling as the Python API.
 * Voice enrollment and preview also call the provider, which can take longer
 * than the small status/read requests the default timeout was tuned for.
 */
const VOICE_UPLOAD_MAX_BODY_BYTES = 16_000_000;
const VOICE_UPSTREAM_TIMEOUT_MS = 180_000;
/** Headers an HTTP proxy must not copy between hops. */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

/**
 * Schema defaults, kept in one place so the Cordis schema and the runtime
 * reader cannot drift. Every key that the Python side also has keeps the exact
 * `Settings` field name from `src/wechat_agent/config.py` (`desktop_host`,
 * `desktop_port`, `desktop_token`, `wechat_group_names`); the first three are
 * also the `--host` / `--port` CLI flags and `DESKTOP_*` environment names.
 *
 * `remote_url` is the one key the Python side does not have: it points the
 * plugin at a console that already runs elsewhere (the Linux VM), so the host
 * DSH reads live state without starting anything locally. `remote_ssh` is the
 * second: it tells the plugin to reach that console through its own SSH tunnel,
 * which covers the VM's loopback-only bind without exposing the port.
 */
const DEFAULTS = Object.freeze({
  remote_ssh: '',
  remote_url: '',
  python: '',
  project_dir: '',
  config_file: '',
  desktop_host: '127.0.0.1',
  desktop_port: 8765,
  desktop_token: '',
  wechat_group_names: [],
});

/**
 * Plugin configuration. The DSH settings page renders this schema; values are
 * handed to the Python console in the same names it already reads.
 */
export const Config = z.object({
  remote_ssh: z
    .string()
    .default(DEFAULTS.remote_ssh)
    .description(
      '虚拟机 SSH 目标，例如 wx@192.168.1.50。填写后插件用 `ssh -N -L 8765:127.0.0.1:8765` 自己维持隧道，'
      + '无需在虚拟机暴露控制台端口；留空且 remote_url 为空时走本机模式。使用默认密钥，不读本机 .env 的令牌。',
    ),
  remote_url: z
    .string()
    .default(DEFAULTS.remote_url)
    .description(
      '直连控制台地址，例如 http://192.168.1.50:8765（控制台已监听该地址时使用）。'
      + '与 remote_ssh 同时填写时，地址里的端口即隧道两端使用的端口。留空则按 remote_ssh 或 desktop_host/desktop_port 决定。',
    ),
  python: z
    .string()
    .default(DEFAULTS.python)
    .description('Python 解释器路径；留空时优先使用 <项目目录>/.venv 里的解释器，否则用 python/python3。仅在本地模式下启动控制台。'),
  project_dir: z
    .string()
    .default(DEFAULTS.project_dir)
    .description('仓库根目录（含 src/wechat_agent）；留空时取插件包的上一级目录，本地路径安装即仓库根。仅在本地模式下使用。'),
  config_file: z
    .string()
    .default(DEFAULTS.config_file)
    .description('传给 `wechat_agent desktop --config` 的 .env 路径；留空时 Python 读 <项目目录>/.env。仅在本地模式下使用。'),
  desktop_host: z
    .string()
    .default(DEFAULTS.desktop_host)
    .description('本地控制台监听地址（对应 Settings.desktop_host 与 --host）；非本机地址必须同时设置 token。远程模式忽略此项。'),
  desktop_port: z
    .number()
    .step(1)
    .min(1)
    .max(65535)
    .default(DEFAULTS.desktop_port)
    .description('本地控制台监听端口（对应 Settings.desktop_port 与 --port）。远程模式忽略此项。'),
  desktop_token: z
    .string()
    .default(DEFAULTS.desktop_token)
    .description('控制台访问令牌（对应 Settings.desktop_token）；本地模式留空时沿用 .env 里的 DESKTOP_TOKEN，远程模式留空表示远端未设令牌。'),
  wechat_group_names: z
    .array(z.string())
    .default([...DEFAULTS.wechat_group_names])
    .description('回复群聊列表（对应 Settings.wechat_group_names）；留空时沿用 .env 里的 WECHAT_GROUP_NAMES。仅在本地模式下传递。'),
});

/** One-line error text for logs and HTTP bodies. */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

/** `~/x` and `~\x` expand against the host user's home directory. */
function expandHome(value) {
  if (value === '~') return homedir();
  if (value.startsWith('~/') || value.startsWith('~\\')) return join(homedir(), value.slice(2));
  return value;
}

/** Repository root: explicit `project_dir`, else the directory above this package. */
function resolveProjectDir(settings) {
  const configured = settings.project_dir.trim();
  return configured
    ? resolve(expandHome(configured))
    : resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

/** Absolute `--config` path, resolved the way Python resolves a relative one: against cwd. */
function resolveConfigFile(settings, projectDir) {
  const configured = settings.config_file.trim();
  return configured ? resolve(projectDir, expandHome(configured)) : '';
}

/**
 * Interpreter: explicit config, else the repository virtualenv (the documented
 * setup), else the platform's default `python3` / `python` name.
 */
function resolvePython(settings, projectDir) {
  const configured = settings.python.trim();
  if (configured) return configured;
  const venv = process.platform === 'win32'
    ? join(projectDir, '.venv', 'Scripts', 'python.exe')
    : join(projectDir, '.venv', 'bin', 'python');
  if (existsSync(venv)) return venv;
  return process.platform === 'win32' ? 'python' : 'python3';
}

/**
 * Read one key from a dotenv file. Only the console token needs this: when the
 * schema leaves `desktop_token` empty the Python console authenticates with
 * `DESKTOP_TOKEN` from the same `.env` it loads, and the proxy must send that
 * same token. Reading the file here keeps both sides on one value.
 */
function readEnvValue(file, key) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return '';
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equals = line.indexOf('=');
    if (equals < 0) continue;
    const name = line.slice(0, equals).trim().replace(/^export\s+/, '');
    if (name.toLowerCase() !== key.toLowerCase()) continue;
    let value = line.slice(equals + 1).trim();
    if (value.length >= 2) {
      const first = value[0];
      const last = value[value.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        value = value.slice(1, -1);
      }
    }
    return value;
  }
  return '';
}

/** Effective console token: the schema value wins; otherwise the console's own .env. */
function resolveToken(settings, projectDir, configFile) {
  const configured = settings.desktop_token.trim();
  if (configured) return configured;
  const envFile = configFile || join(projectDir, '.env');
  return readEnvValue(envFile, 'DESKTOP_TOKEN').trim();
}

/** Normalize the schema list to the comma-separated value Python expects. */
function groupNamesOf(settings) {
  if (!Array.isArray(settings.wechat_group_names)) return [];
  return settings.wechat_group_names.map((value) => String(value).trim()).filter(Boolean);
}

/**
 * Parse `remote_url` into the pieces a direct connection needs.
 *
 * Only `http:` / `https:` are accepted; a path is kept as a base prefix so a
 * console published under a reverse-proxy subpath still works. A value that
 * does not parse is a configuration error, not a reason to fall back to a local
 * console behind the user's back: `planUpstream` keeps the error and every
 * route answers a clear 502 until it is fixed.
 */
function parseRemoteUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return { error: `remote_url 不是合法地址：${value}` };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { error: `remote_url 只支持 http/https：${value}` };
  }
  const basePath = url.pathname.replace(/\/+$/, '');
  return {
    protocol: url.protocol,
    // `URL.hostname` keeps IPv6 brackets; the socket layer wants them off.
    host: url.hostname.replace(/^\[|\]$/g, ''),
    port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
    basePath,
    target: `${url.protocol}//${url.host}${basePath}`,
    error: '',
  };
}

/**
 * Decide where the console lives. Precedence:
 *
 *   1. `remote_ssh` — the VM console binds loopback, so the plugin owns an
 *      `ssh -L` tunnel and dials 127.0.0.1.<port>. `remote_url` only supplies
 *      the port in this mode (both sides of the tunnel use it).
 *   2. `remote_url` — a console reachable over the network as-is.
 *   3. neither — the historical local console on `desktop_host:desktop_port`.
 *
 * The returned `transport` is null when the configuration cannot be dialed at
 * all; callers turn that into readable 502s and health errors.
 */
function planUpstream(settings) {
  const sshTarget = String(settings.remote_ssh || '').trim();
  const remote = parseRemoteUrl(settings.remote_url);

  if (sshTarget) {
    if (remote && remote.error) {
      return { mode: 'remote', transport: null, protocol: 'http:', host: '', port: 0, basePath: '', target: `ssh://${sshTarget}`, tunnel: { target: sshTarget, port: 0 }, error: remote.error };
    }
    const port = (remote && remote.port) || settings.desktop_port;
    return {
      mode: 'remote',
      transportKind: 'ssh',
      protocol: 'http:',
      host: '127.0.0.1',
      port,
      basePath: '',
      target: `ssh://${sshTarget} → 127.0.0.1:${port}`,
      tunnel: { target: sshTarget, port },
      error: '',
    };
  }

  if (remote) {
    if (remote.error) {
      return { mode: 'remote', transport: null, protocol: 'http:', host: '', port: 0, basePath: '', target: String(settings.remote_url).trim(), tunnel: null, error: remote.error };
    }
    return {
      mode: 'remote',
      transportKind: 'direct',
      protocol: remote.protocol,
      host: remote.host,
      port: remote.port,
      basePath: remote.basePath,
      target: remote.target,
      tunnel: null,
      error: '',
    };
  }

  const host = settings.desktop_host;
  const port = settings.desktop_port;
  return {
    mode: 'local',
    transportKind: 'direct',
    protocol: 'http:',
    host: upstreamHostOf(host),
    port,
    basePath: '',
    target: `http://${host}:${port}`,
    tunnel: null,
    error: '',
  };
}

/**
 * Describe the connection implied by the plugin settings for the browser.
 *
 * The deployment wizard keeps its own SSH record, but a user who already
 * configured `remote_ssh` is connected without it. The page shows that as
 * "已连接" and prefills its takeover form from this descriptor, so it never
 * asks for the same virtual machine a second time.
 *
 * `remote_ssh` accepts the `user@host` form the tunnel passes to `ssh`
 * (`user@host:port` also works; an absent user means "current user, host only",
 * which the wizard cannot use but the page still reports).
 */
function describePluginConnection(settings) {
  const plan = planUpstream(settings);
  const sshTarget = String(settings.remote_ssh || '').trim();
  if (sshTarget) {
    const match = /^(?:([^@\s]+)@)?(\[[^\]]+\]|[^:\s]+)(?::(\d+))?$/.exec(sshTarget);
    return {
      kind: 'remote_ssh',
      target: plan.target,
      username: match && match[1] ? match[1] : '',
      host: match ? match[2].replace(/^\[|\]$/g, '') : sshTarget,
      port: match && match[3] ? Number(match[3]) : 22,
      consolePort: plan.port || settings.desktop_port,
      tunnel: plan.tunnel ? { target: plan.tunnel.target, port: plan.tunnel.port } : null,
      error: plan.error || '',
    };
  }
  if (plan.mode === 'remote') {
    return {
      kind: 'remote_url',
      target: plan.target,
      username: '',
      host: plan.host || '',
      port: plan.port || 0,
      consolePort: plan.port || 0,
      tunnel: null,
      error: plan.error || '',
    };
  }
  return {
    kind: 'local',
    target: plan.target,
    username: '',
    host: '',
    port: 0,
    consolePort: settings.desktop_port,
    tunnel: null,
    error: plan.error || '',
  };
}

/**
 * Plan for a console reached through the wizard's own SSH connection.
 * The wizard stores credentials and owns an `ssh2` forward from the VM's
 * loopback console to a matching loopback port on this host. That makes the
 * upstream look local while the tunnel service handles authentication,
 * reconnects and the whole "VM is off" story.
 */
function planSetupUpstream(connection) {
  const port = Number(connection.consolePort) || 8765;
  return {
    mode: 'remote',
    transportKind: 'ssh2',
    protocol: 'http:',
    host: '127.0.0.1',
    port,
    basePath: '',
    target: `ssh2://${connection.username}@${connection.host}:${connection.port || 22} → 127.0.0.1:${port}`,
    tunnel: null,
    error: '',
  };
}

/** Turn a plan into the request function used by the proxy and the probe. */
function transportFor(plan) {
  if (plan.error) return null;
  return plan.protocol === 'https:' ? httpsRequest : httpRequest;
}

/**
 * A wildcard bind (`0.0.0.0`, `::`) accepts loopback connections; dialing the
 * wildcard address itself is not portable, so the proxy uses loopback.
 */
function upstreamHostOf(host) {
  if (host === '0.0.0.0') return '127.0.0.1';
  if (host === '::' || host === '[::]') return '::1';
  return host;
}

/** Milliseconds between SSH reconnect attempts. */
const TUNNEL_RETRY_MS = 5_000;
/**
 * How long the `ssh -L` supervisor waits for a previous owner (the setup
 * wizard's `ssh2` tunnel during a takeover or disconnect) to release the local
 * port before deciding the listener belongs to someone else.
 */
const TUNNEL_PORT_RELEASE_MS = 2_500;

/**
 * True when something already listens on `host:port` — typically a tunnel the
 * user started by hand (scripts/vm-tunnel.ps1). Reusing it keeps the plugin
 * from fighting over the local port.
 */
function portIsOpen(host, port, timeoutMs = 800) {
  return new Promise((resolve) => {
    const socket = connect({ host, port });
    let settled = false;
    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

/**
 * `ssh -N -L 127.0.0.1:<port>:127.0.0.1:<port> <target>`, supervised.
 *
 * The VM console binds loopback on purpose, so the tunnel is how the host
 * reaches it without exposing the port on the VM's network. The child is
 * restarted after every exit until `stop()`; a tunnel that someone else owns
 * (already listening on the local port) is reused instead of duplicated.
 */
function startSshTunnel({ logger, target, port }) {
  const state = { target, port, mode: 'starting', restarts: 0, error: '', external: false };
  let child = null;
  let timer = null;
  let stopping = false;
  let probing = true;

  const scheduleRetry = () => {
    if (stopping || timer) return;
    timer = setTimeout(() => {
      timer = null;
      launch();
    }, TUNNEL_RETRY_MS);
    timer.unref?.();
  };

  const launch = () => {
    if (stopping) return;
    const args = [
      '-N',
      '-o', 'BatchMode=yes',
      '-o', 'ExitOnForwardFailure=yes',
      '-o', 'ServerAliveInterval=30',
      '-o', 'ServerAliveCountMax=3',
      '-L', `127.0.0.1:${port}:127.0.0.1:${port}`,
      target,
    ];
    logger.info(`attune: ssh tunnel 127.0.0.1:${port} → ${target}:${port}`);
    try {
      // stdio is discarded: `ssh -N` writes nothing useful on success, and
      // piped stdio is the one spawn shape some hosts deny. Lifecycle and the
      // exit code carry all the diagnostics this supervisor needs.
      child = spawn('ssh', args, { stdio: 'ignore', windowsHide: true });
    } catch (error) {
      state.mode = 'stopped';
      state.error = messageOf(error);
      logger.warn(`attune: ssh tunnel could not start: ${state.error}`);
      scheduleRetry();
      return;
    }
    state.mode = 'running';
    state.error = '';
    child.on('error', (error) => {
      state.mode = 'stopped';
      state.error = messageOf(error);
    });
    child.on('exit', (code, signal) => {
      state.mode = 'stopped';
      if (stopping) return;
      state.restarts += 1;
      state.error = signal ? `signal ${signal}` : `exit code ${code}`;
      logger.warn(
        `attune: ssh tunnel exited (${state.error}); retrying in ${TUNNEL_RETRY_MS / 1000}s`,
      );
      scheduleRetry();
    });
  };

  const start = async () => {
    if (stopping) return;
    // Someone else may already forward this port (a manual tunnel). Reusing it
    // is both cheaper and avoids ExitOnForwardFailure loops. During a wizard
    // takeover/disconnect the previous tunnel may still be closing on this
    // port, so wait briefly before deciding it is foreign.
    const deadline = Date.now() + TUNNEL_PORT_RELEASE_MS;
    let open = await portIsOpen('127.0.0.1', port);
    while (open && Date.now() < deadline && !stopping) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      open = await portIsOpen('127.0.0.1', port);
    }
    probing = false;
    if (stopping) return;
    if (open) {
      state.mode = 'external';
      state.external = true;
      logger.info(`attune: 127.0.0.1:${port} is already forwarded; reusing the existing tunnel`);
      return;
    }
    launch();
  };

  start();

  return {
    status() {
      return {
        target,
        port,
        mode: probing ? 'starting' : state.mode,
        external: state.external,
        restarts: state.restarts,
        error: state.error,
      };
    },
    stop() {
      if (stopping) return;
      stopping = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (child && child.exitCode === null) {
        try {
          child.kill('SIGTERM');
        } catch (error) {
          logger.warn(`attune: cannot stop the ssh tunnel: ${messageOf(error)}`);
        }
      }
    },
  };
}

/** JSON reply helper. */
function sendJson(res, statusCode, payload) {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(body);
}

/**
 * Same-origin proxy for the console API. The console's own route table decides
 * what exists; this handler forwards the path unchanged under `/api` and only
 * adds the token the console client must present. The upstream is remote when
 * `remote_url` is configured and local otherwise, so both modes share one
 * handler instead of two near-identical code paths.
 */
function createProxy({ getUpstream, getToken, logger }) {
  return (req, res) => {
    const upstream = getUpstream();
    const token = getToken();
    const method = req.method || 'GET';
    if (method !== 'GET' && method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('allow', 'GET, POST');
      res.end();
      return;
    }

    if (!upstream.transport) {
      sendJson(res, 502, { error: 'wechat_console_unavailable', detail: upstream.error });
      return;
    }

    const url = new URL(req.url || API_PREFIX, 'http://127.0.0.1');
    if (url.pathname !== API_PREFIX && !url.pathname.startsWith(`${API_PREFIX}/`)) {
      sendJson(res, 404, { error: 'not_found' });
      return;
    }
    const upstreamPath = `${upstream.basePath}/api${url.pathname.slice(API_PREFIX.length)}${url.search}`;
    const relativePath = url.pathname.slice(API_PREFIX.length);
    const isVoiceRoute = relativePath.startsWith('/voice/');
    const bodyLimit = relativePath === '/personas/upload'
      ? PERSONA_UPLOAD_MAX_BODY_BYTES
      : relativePath === '/voice/profiles'
        ? VOICE_UPLOAD_MAX_BODY_BYTES
        : MAX_BODY_BYTES;
    const upstreamTimeout = isVoiceRoute ? VOICE_UPSTREAM_TIMEOUT_MS : UPSTREAM_TIMEOUT_MS;

    const headers = {};
    for (const header of ['accept', 'content-type']) {
      const value = req.headers[header];
      if (value !== undefined) headers[header] = value;
    }
    if (token) headers['x-desktop-token'] = token;

    let finished = false;
    let pending = null;

    const fail = (statusCode, error) => {
      if (finished) return;
      finished = true;
      sendJson(res, statusCode, {
        error: statusCode === 504 ? 'wechat_console_timeout' : 'wechat_console_unavailable',
        detail: error,
      });
    };

    // The console reads `Content-Length` (BaseHTTPRequestHandler), so a chunked
    // POST would arrive with an empty body. Buffer the small JSON body and send
    // it with a length, the same way the console's own pages do.
    const forward = (body) => {
      if (body !== null) headers['content-length'] = String(body.length);
      pending = upstream.transport(
        {
          host: upstream.host,
          port: upstream.port,
          method,
          path: upstreamPath,
          headers,
          timeout: upstreamTimeout,
        },
        (upstreamRes) => {
          finished = true;
          const responseHeaders = { 'cache-control': 'no-store' };
          for (const [key, value] of Object.entries(upstreamRes.headers)) {
            if (HOP_BY_HOP.has(key)) continue;
            responseHeaders[key] = value;
          }
          res.writeHead(upstreamRes.statusCode || 502, responseHeaders);
          upstreamRes.pipe(res);
        },
      );

      pending.on('timeout', () => pending.destroy(new Error('wechat console timeout')));
      pending.on('error', (error) => {
        if (finished) {
          res.destroy();
          return;
        }
        const timedOut = error.message === 'wechat console timeout';
        logger.warn(`attune: proxy ${method} ${upstreamPath} failed: ${messageOf(error)}`);
        if (timedOut) {
          fail(504, 'wechat console timeout');
        } else {
          fail(502, messageOf(error));
        }
      });
      res.on('close', () => {
        if (finished) return;
        finished = true;
        if (pending) pending.destroy();
      });
      pending.end(body === null ? undefined : body);
    };

    if (method === 'POST') {
      const chunks = [];
      let size = 0;
      let tooLarge = false;
      let settled = false;
      req.on('data', (chunk) => {
        if (tooLarge) return;
        size += chunk.length;
        if (size > bodyLimit) {
          tooLarge = true;
          chunks.length = 0;
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        if (settled) return;
        settled = true;
        if (tooLarge) {
          sendJson(res, 413, { error: 'request_body_too_large' });
          return;
        }
        forward(Buffer.concat(chunks, size));
      });
      req.on('error', (error) => {
        if (settled) return;
        settled = true;
        finished = true;
        sendJson(res, 400, { error: 'bad_request', detail: messageOf(error) });
      });
      res.on('close', () => {
        if (settled) return;
        settled = true;
        finished = true;
        if (pending) pending.destroy();
      });
      return;
    }

    forward(null);
  };
}

/**
 * Start `python -m wechat_agent desktop` (the real CLI command; `__main__.py`
 * passes through to `main.main()` whose subcommands include `desktop`).
 *
 * Config is split exactly as the Python CLI reads it:
 *   --host / --port      override Settings.desktop_host / desktop_port;
 *   --config <path>      selects the .env file;
 *   DESKTOP_TOKEN        environment fallback for Settings.desktop_token;
 *   WECHAT_GROUP_NAMES   environment fallback for Settings.wechat_group_names.
 * The schema leaves the last two unset when blank so the console's own .env
 * keeps providing them.
 */
function startConsole({ logger, python, projectDir, configFile, host, port, token, groupNames }) {
  const args = ['-m', 'wechat_agent', 'desktop', '--host', host, '--port', String(port)];
  if (configFile) args.push('--config', configFile);

  const env = { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' };
  const sourceRoot = join(projectDir, 'src');
  if (existsSync(join(sourceRoot, 'wechat_agent'))) {
    env.PYTHONPATH = env.PYTHONPATH ? `${sourceRoot}${delimiter}${env.PYTHONPATH}` : sourceRoot;
  }
  if (token) env.DESKTOP_TOKEN = token;
  if (groupNames.length > 0) env.WECHAT_GROUP_NAMES = groupNames.join(',');

  let stopping = false;
  let child;
  try {
    child = spawn(python, args, {
      cwd: projectDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch (error) {
    logger.error(`attune: cannot start the Python console: ${messageOf(error)}`);
    return { stop() {} };
  }

  const relay = (stream, level) => {
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      for (const line of String(chunk).split(/\r?\n/)) {
        const text = line.trim();
        if (text) logger[level](`attune: ${text}`);
      }
    });
  };
  relay(child.stdout, 'info');
  relay(child.stderr, 'warn');

  child.on('error', (error) => {
    logger.error(`attune: Python console failed: ${messageOf(error)}`);
  });
  child.on('exit', (code, signal) => {
    if (stopping) {
      logger.info('attune: Python console stopped');
      return;
    }
    const detail = signal ? `signal ${signal}` : `code ${code}`;
    logger.warn(
      `attune: Python console exited (${detail}); ${API_PREFIX} answers 502 until a console is reachable`,
    );
  });

  return {
    stop() {
      if (stopping) return;
      stopping = true;
      if (!child || child.exitCode !== null) return;
      try {
        child.kill('SIGTERM');
      } catch (error) {
        logger.warn(`attune: cannot stop the Python console: ${messageOf(error)}`);
      }
    },
  };
}

/**
 * `GET /wechat/health` — the one place the DSH host (and the panel) learns
 * whether the console behind this plugin is alive.
 *
 * It always answers 200 with a JSON document, even when the VM is unreachable:
 * a probe that throws is useless to a host that wants to render a state. The
 * body carries the mode (`remote`/`local`), the target it dials, the latency,
 * and the console's own `phase` / `thread_alive` when it could be read.
 */
function createHealth({ getUpstream, getToken, getTunnel }) {
  const tunnelStatus = () => {
    const tunnel = getTunnel();
    return tunnel ? tunnel.status() : null;
  };

  return (req, res) => {
    const upstream = getUpstream();
    const token = getToken();
    const method = req.method || 'GET';
    if (method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('allow', 'GET');
      res.end();
      return;
    }
    if (!upstream.transport) {
      sendJson(res, 200, {
        mode: upstream.mode,
        transport: upstream.transportKind || 'direct',
        target: upstream.target,
        reachable: false,
        http_status: 0,
        latency_ms: 0,
        console: null,
        tunnel: tunnelStatus(),
        error: upstream.error,
        checked_at: new Date().toISOString(),
      });
      return;
    }

    const startedAt = Date.now();
    const headers = { accept: 'application/json' };
    if (token) headers['x-desktop-token'] = token;
    let finished = false;
    let pending = null;

    const answer = (payload) => {
      if (finished) return;
      finished = true;
      sendJson(res, 200, {
        mode: upstream.mode,
        transport: upstream.transportKind || 'direct',
        target: upstream.target,
        latency_ms: Date.now() - startedAt,
        tunnel: tunnelStatus(),
        checked_at: new Date().toISOString(),
        ...payload,
      });
    };

    pending = upstream.transport(
      {
        host: upstream.host,
        port: upstream.port,
        method: 'GET',
        path: `${upstream.basePath}/api/status`,
        headers,
        timeout: HEALTH_TIMEOUT_MS,
      },
      (probe) => {
        const chunks = [];
        let size = 0;
        probe.on('data', (chunk) => {
          if (size >= 262_144) return;
          const kept = chunk.length > 262_144 - size ? chunk.subarray(0, 262_144 - size) : chunk;
          chunks.push(kept);
          size += kept.length;
        });
        probe.on('end', () => {
          let body = null;
          try {
            body = JSON.parse(Buffer.concat(chunks, size).toString('utf8'));
          } catch {
            body = null;
          }
          const status = Number(probe.statusCode || 0);
          const unauthorized = status === 401;
          answer({
            reachable: !unauthorized && status > 0 && status < 500,
            http_status: status,
            console: body && typeof body === 'object'
              ? {
                phase: body.phase ?? null,
                thread_alive: body.thread_alive ?? null,
                group_name: body.group_name ?? null,
                send_enabled: body.send_enabled ?? null,
                last_error: body.last_error ?? null,
              }
              : null,
            error: unauthorized
              ? '远端控制台要求令牌，请在插件设置里填写 desktop_token'
              : (status >= 500 ? `HTTP ${status}` : ''),
          });
        });
        probe.on('error', (error) => answer({ reachable: false, http_status: 0, console: null, error: messageOf(error) }));
      },
    );

    pending.on('timeout', () => pending.destroy(new Error(`wechat console timeout after ${HEALTH_TIMEOUT_MS}ms`)));
    pending.on('error', (error) => answer({ reachable: false, http_status: 0, console: null, error: messageOf(error) }));
    res.on('close', () => {
      if (finished) return;
      finished = true;
      if (pending) pending.destroy();
    });
    pending.end();
  };
}

/**
 * Register the proxy and own whatever connects this host to the console.
 *
 * Three modes, one code path:
 *   ssh    — `remote_ssh` names the VM; the plugin supervises `ssh -L` and the
 *            host DSH reads the VM through it (the VM keeps its loopback bind);
 *   remote — `remote_url` points at a console reachable over the network;
 *   local  — the historical behaviour: spawn `python -m wechat_agent desktop`
 *            on `desktop_host:desktop_port` and stop it on dispose.
 *
 * Registration is the fiber effect returned by `webServer.register`, so the
 * route disappears with the plugin. The tunnel / console is stopped by a later
 * effect and its disposer runs before the route teardown (effects dispose in
 * reverse order), so no in-flight proxied request outlives its transport.
 */
export function apply(ctx, config) {
  const settings = { ...DEFAULTS, ...(config || {}) };
  const webServer = ctx.get('webServer');

  if (!webServer) {
    ctx.logger.info('attune: this profile has no webServer; console proxy and panel stay idle');
    return;
  }

  const projectDir = resolveProjectDir(settings);
  const configFile = resolveConfigFile(settings, projectDir);
  const python = resolvePython(settings, projectDir);

  let upstream = null;
  let token = '';
  let systemTunnel = null;
  let consoleProcess = null;

  // Hoisted so the setup service can call it while the plugin is still being
  // applied (the callback only fires after a request, never synchronously).
  function refreshPlan() {
    const connection = setup.getConnection();
    const plan = connection ? planSetupUpstream(connection) : planUpstream(settings);
    upstream = { ...plan, transport: transportFor(plan) };
    token = resolveCurrentToken(upstream, connection);

    if (connection) {
      if (systemTunnel) {
        systemTunnel.stop();
        systemTunnel = null;
      }
      setup.ensureTunnel();
    } else {
      setup.stop();
      if (plan.tunnel && !systemTunnel) {
        systemTunnel = startSshTunnel({
          logger: ctx.logger,
          target: plan.tunnel.target,
          port: plan.tunnel.port,
        });
      } else if (!plan.tunnel && systemTunnel) {
        systemTunnel.stop();
        systemTunnel = null;
      }
    }

    if (upstream.mode === 'local' && !consoleProcess) {
      consoleProcess = startConsole({
        logger: ctx.logger,
        python,
        projectDir,
        configFile,
        host: settings.desktop_host,
        port: settings.desktop_port,
        token,
        groupNames: groupNamesOf(settings),
      });
    } else if (upstream.mode !== 'local' && consoleProcess) {
      consoleProcess.stop();
      consoleProcess = null;
    }
  };

  /** Effective token for the console the current plan dials. */
  const resolveCurrentToken = (plan, connection) => {
    if (plan.mode !== 'remote') return resolveToken(settings, projectDir, configFile);
    if (connection) return connection.token || settings.desktop_token.trim();
    return settings.desktop_token.trim();
  };

  const setup = createSetupService({
    logger: ctx.logger,
    onConnectionChange: () => refreshPlan(),
    externalProvider: () => describePluginConnection(settings),
  });

  refreshPlan();

  ctx.effect(
    () => webServer.register({
      kind: 'prefix',
      path: API_PREFIX,
      handler: createProxy({
        getUpstream: () => upstream,
        getToken: () => token,
        logger: ctx.logger,
      }),
    }),
    'attune: same-origin /wechat/api proxy',
  );

  ctx.effect(
    () => webServer.register({
      kind: 'exact',
      path: HEALTH_PATH,
      handler: createHealth({
        getUpstream: () => upstream,
        getToken: () => token,
        getTunnel: () => (setup.getConnection() ? setup : systemTunnel),
      }),
    }),
    'attune: /wechat/health console probe',
  );

  ctx.effect(
    () => webServer.register({
      kind: 'prefix',
      path: SETUP_PREFIX,
      handler: (req, res) => setup.handle(req, res),
    }),
    'attune: one-click VM setup routes',
  );

  ctx.effect(
    () => () => {
      setup.stop();
      if (systemTunnel) systemTunnel.stop();
      if (consoleProcess) consoleProcess.stop();
    },
    'attune: stop tunnel and console',
  );

  if (!upstream.transport) {
    ctx.logger.error(
      `attune: ${upstream.error}; routes answer 502 until the connection is fixed`,
    );
  }
  ctx.logger.info(
    `attune: console ${upstream.mode} ${upstream.target}; `
    + `panel read ${API_PREFIX}/{members,groups}, status ${HEALTH_PATH}, setup ${SETUP_PREFIX}/state`,
  );
}
