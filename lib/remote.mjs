/**
 * SSH transport for the one-click VM setup wizard.
 *
 * The plugin historically reached the VM through the system `ssh` binary and a
 * `remote_ssh` setting, which only works with key-based auth and requires the
 * user to edit configuration. For hand-off to non-technical users the wizard
 * accepts a host, user and password directly. `ssh2` gives the host process
 * password auth, SFTP uploads, remote command execution and a TCP forward for
 * the console — all in-process, no external tools on the DSH machine.
 *
 * This module is transport only. Deployment policy (what to upload, which
 * `bootstrap-xubuntu.sh` phase to run) lives in `setup.mjs`.
 */

import ssh2 from 'ssh2';

import { createReadStream, readFileSync } from 'node:fs';
import { connect as netConnect, createServer } from 'node:net';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const { Client } = ssh2;

/** How long a fresh connection may take before it is reported as a timeout. */
const READY_TIMEOUT_MS = 15_000;
/** How often an idle tunnel connection is probed. */
const KEEPALIVE_MS = 15_000;
/** Delay before re-opening a dropped tunnel, growing to `MAX_RETRY_MS`. */
const RETRY_MS = 2_000;
const MAX_RETRY_MS = 15_000;
/** How long a tunnel waits for the previous owner to release the local port. */
const PORT_RELEASE_MS = 2_500;

/** Expand `~` and `~/…` without touching the remote shell. */
export function expandHomePath(path) {
  const value = String(path || '').trim();
  if (!value) return value;
  if (value === '~') return homedir();
  if (value.startsWith('~/') || value.startsWith('~\\')) return join(homedir(), value.slice(2));
  return resolve(value);
}

/** Quote a value for a POSIX shell single-quoted string. */
export function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

/**
 * Turn a wizard connection record into `ssh2` auth options.
 *
 * Password auth also enables keyboard-interactive: some Ubuntu configurations
 * disable `PasswordAuthentication` but keep PAM keyboard auth, and the user
 * experience is identical from the wizard's point of view.
 */
export function authFor(connection) {
  const auth = {};
  if (connection.authType === 'key') {
    const keyPath = expandHomePath(connection.privateKeyPath || '~/.ssh/id_ed25519');
    let key;
    try {
      key = readFileSync(keyPath);
    } catch (error) {
      throw new Error(`找不到私钥文件 ${keyPath}（${error.code || '读取失败'}）；也可以改用密码登录`);
    }
    auth.privateKey = key;
    if (connection.passphrase) auth.passphrase = connection.passphrase;
    return auth;
  }
  if (!connection.password) throw new Error('密码为空');
  auth.password = connection.password;
  auth.tryKeyboard = true;
  return auth;
}

/** A readable, Chinese explanation for the usual SSH failure modes. */
export function explainSshError(error, connection) {
  const message = error instanceof Error ? error.message : String(error);
  const host = connection ? `${connection.username}@${connection.host}:${connection.port || 22}` : '目标主机';
  if (/ECONNREFUSED/i.test(message)) return `连接 ${host} 被拒绝：SSH 端口不对，或虚拟机上没有安装/启动 openssh-server`;
  if (/ENOTFOUND|EAI_AGAIN/i.test(message)) return `找不到主机 ${connection?.host || ''}：IP 地址是否正确，虚拟机和这台电脑在同一网络吗`;
  if (/ETIMEDOUT|timed out|timeout/i.test(message)) return `连接 ${host} 超时：检查虚拟机是否开机、网卡是否为 NAT/桥接、防火墙是否放行 22 端口`;
  if (/All configured authentication methods failed|authentication/i.test(message)) {
    return `登录失败：用户名、密码或私钥不对（${message}）`;
  }
  return message;
}

/**
 * Open an SSH connection and resolve once it is ready.
 *
 * The returned client is owned by the caller; every call site closes it. The
 * tunnel keeps its own long-lived client.
 */
export function connectSsh({ connection, logger, readyTimeout = READY_TIMEOUT_MS }) {
  return new Promise((resolvePromise, reject) => {
    const client = new Client();
    const auth = authFor(connection);
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (error) {
        client.removeAllListeners();
        try {
          client.end();
        } catch {
          // The socket may already be gone; nothing to clean up.
        }
        reject(error);
        return;
      }
      resolvePromise(client);
    };

    client.once('ready', () => finish(null));
    client.once('error', (error) => {
      if (settled) {
        logger?.warn?.(`wechat-agent setup: SSH 连接出错：${messageOf(error)}`);
        return;
      }
      finish(new Error(explainSshError(error, connection)));
    });
    if (auth.tryKeyboard) {
      client.on('keyboard-interactive', (_name, _instructions, _language, _prompts, finishPrompt) => {
        finishPrompt([connection.password]);
      });
    }
    try {
      client.connect({
        host: connection.host,
        port: Number(connection.port) || 22,
        username: connection.username,
        ...auth,
        readyTimeout,
        keepaliveInterval: 10_000,
      });
    } catch (error) {
      finish(new Error(explainSshError(error, connection)));
    }
  });
}

/** Close a client without letting teardown errors escape. */
export function endSsh(client) {
  if (!client) return;
  try {
    client.end();
  } catch {
    // Already closed.
  }
}

/**
 * Run a remote command.
 *
 * @param {import('ssh2').Client} client
 * @param {string} command POSIX shell command
 * @param {{ timeoutMs?: number, onLine?: (line: string) => void, maxOutput?: number, input?: string|Buffer }} [options]
 * @returns {Promise<{ code: number|null, stdout: string, stderr: string, timedOut: boolean }>}
 */
export function execSsh(client, command, options = {}) {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const maxOutput = options.maxOutput ?? 8 * 1024 * 1024;
  const onLine = options.onLine;
  return new Promise((resolvePromise, reject) => {
    let settled = false;
    let timedOut = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolvePromise(result);
    };
    let timer = null;
    client.exec(command, { pty: false }, (error, stream) => {
      if (error) {
        reject(new Error(`远程命令启动失败：${messageOf(error)}`));
        return;
      }
      const chunks = [];
      const errChunks = [];
      let size = 0;
      let pending = '';
      const consume = (chunk, streamName) => {
        const text = String(chunk);
        size += text.length;
        (streamName === 'stderr' ? errChunks : chunks).push(text);
        if (onLine) {
          // Data may split lines anywhere; buffer the tail until a newline.
          pending += text;
          const lines = pending.split(/\r?\n/);
          pending = lines.pop() ?? '';
          for (const raw of lines) {
            const line = raw.replace(/\r$/, '');
            if (line.length > 0) onLine(line);
          }
        }
      };
      stream.on('data', (chunk) => consume(chunk, 'stdout'));
      stream.stderr.on('data', (chunk) => consume(chunk, 'stderr'));
      if (options.input !== undefined) {
        // Used for `sudo -S` password prompts: send once, then end the stdin
        // side of the channel so the command does not wait for more input.
        stream.end(options.input);
      }
      stream.on('close', (code) => {
        if (onLine && pending.trim()) onLine(pending);
        finish({
          code: code ?? null,
          stdout: chunks.join('').slice(0, maxOutput),
          stderr: errChunks.join('').slice(0, maxOutput),
          timedOut,
        });
      });
      timer = setTimeout(() => {
        timedOut = true;
        try {
          stream.close();
        } catch {
          // Best effort.
        }
      }, timeoutMs);
      timer.unref?.();
    });
  });
}

/** Upload one buffer to `remotePath` (home-relative paths are expanded remotely). */
export function uploadSsh(client, buffer, remotePath) {
  return new Promise((resolvePromise, reject) => {
    client.sftp((error, sftp) => {
      if (error) {
        reject(new Error(`SFTP 不可用：${messageOf(error)}（虚拟机上是否禁用了 sftp 子系统？）`));
        return;
      }
      const output = sftp.createWriteStream(remotePath, { mode: 0o600 });
      output.once('error', (writeError) => {
        try {
          sftp.end();
        } catch {
          // ignore
        }
        reject(new Error(`上传 ${remotePath} 失败：${messageOf(writeError)}`));
      });
      output.once('close', () => {
        try {
          sftp.end();
        } catch {
          // ignore
        }
        resolvePromise();
      });
      output.end(buffer);
    });
  });
}

/** Upload a local file to `remotePath` without buffering it in memory. */
export function uploadFileSsh(client, localPath, remotePath) {
  return new Promise((resolvePromise, reject) => {
    client.sftp((error, sftp) => {
      if (error) {
        reject(new Error(`SFTP 不可用：${messageOf(error)}`));
        return;
      }
      const writeStream = sftp.createWriteStream(remotePath, { mode: 0o600 });
      const readStream = createReadStream(localPath);
      let settled = false;
      const finish = (streamError) => {
        if (settled) return;
        settled = true;
        try {
          readStream.destroy();
          sftp.end();
        } catch {
          // ignore
        }
        if (streamError) reject(new Error(`上传 ${remotePath} 失败：${messageOf(streamError)}`));
        else resolvePromise();
      };
      readStream.once('error', finish);
      writeStream.once('error', finish);
      writeStream.once('close', () => finish(null));
      readStream.pipe(writeStream);
    });
  });
}

/** Quick TCP probe used both to reuse an existing forward and to test the console. */
export function portIsOpen(host, port, timeoutMs = 800) {
  return new Promise((resolvePromise) => {
    const socket = netConnect({ host, port });
    let settled = false;
    const finish = (open) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolvePromise(open);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * A loopback port forwarded to the VM console over SSH, with reconnect.
 *
 * The console binds `127.0.0.1` on the VM on purpose (it has no auth by
 * default), so the host reaches it through this forward. Unlike the historical
 * `ssh -L` child process this one supports password auth and starts from the
 * wizard without a plugin restart.
 *
 * @param {{
 *   logger: { info: Function, warn: Function },
 *   getConnection: () => (object|null),
 *   localPort: number,
 *   remotePort?: number,
 * }} options
 */
export function createSsh2Tunnel({ logger, getConnection, localPort, remotePort = 8765 }) {
  const state = {
    mode: 'starting',
    error: '',
    restarts: 0,
    external: false,
    connectedAt: null,
  };
  let server = null;
  let client = null;
  let connecting = null;
  let retryTimer = null;
  let stopping = false;
  let retryDelay = RETRY_MS;
  const sockets = new Set();

  const status = () => ({
    mode: state.mode,
    error: state.error,
    restarts: state.restarts,
    external: state.external,
    connectedAt: state.connectedAt,
  });

  const destroySockets = () => {
    for (const socket of sockets) socket.destroy();
    sockets.clear();
  };

  const scheduleRetry = () => {
    if (stopping || retryTimer) return;
    const delay = retryDelay;
    retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
    retryTimer = setTimeout(() => {
      retryTimer = null;
      ensureClient().catch(() => {});
    }, delay);
    retryTimer.unref?.();
  };

  const ensureClient = () => {
    if (stopping) return Promise.reject(new Error('tunnel stopped'));
    if (client) return Promise.resolve(client);
    if (connecting) return connecting;
    const connection = getConnection();
    if (!connection) {
      state.mode = 'stopped';
      state.error = '还没有保存 SSH 连接';
      return Promise.reject(new Error(state.error));
    }
    state.mode = 'starting';
    connecting = connectSsh({ connection, logger, readyTimeout: READY_TIMEOUT_MS })
      .then((connected) => {
        connecting = null;
        if (stopping) {
          endSsh(connected);
          return Promise.reject(new Error('tunnel stopped'));
        }
        client = connected;
        state.mode = 'running';
        state.error = '';
        state.connectedAt = new Date().toISOString();
        retryDelay = RETRY_MS;
        logger.info(`wechat-agent setup: SSH 隧道已连接 ${connection.username}@${connection.host}`);
        connected.on('close', () => {
          client = null;
          destroySockets();
          if (stopping) return;
          state.mode = 'stopped';
          state.error = 'SSH 连接已断开，正在重连';
          state.restarts += 1;
          scheduleRetry();
        });
        connected.on('error', (error) => {
          state.error = explainSshError(error, connection);
        });
        return connected;
      })
      .catch((error) => {
        connecting = null;
        if (stopping) throw error;
        state.mode = 'stopped';
        state.error = error.message || messageOf(error);
        scheduleRetry();
        throw error;
      });
    return connecting;
  };

  const handleConnection = (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
    const connection = getConnection();
    if (!connection) {
      socket.destroy();
      return;
    }
    ensureClient()
      .then((connected) => {
        const sourcePort = socket.remotePort || 0;
        connected.forwardOut('127.0.0.1', sourcePort, '127.0.0.1', remotePort, (error, channel) => {
          if (error) {
            logger.warn(`wechat-agent setup: 转发控制台连接失败：${messageOf(error)}`);
            socket.destroy();
            return;
          }
          channel.pipe(socket);
          socket.pipe(channel);
          channel.on('error', () => socket.destroy());
          channel.on('close', () => socket.destroy());
          socket.on('error', () => channel.destroy());
        });
      })
      .catch(() => socket.destroy());
  };

  const start = async () => {
    if (stopping) return;
    if (!getConnection()) {
      state.mode = 'stopped';
      state.error = '还没有保存 SSH 连接';
      return;
    }
    // The plugin's own `remote_ssh` tunnel may still be closing on the same
    // loopback port (the wizard "takeover" switches it over). Give it a moment
    // to release the port before falling back to external reuse; on WSL mirror
    // networking the port stays open and the reuse branch below still wins.
    const deadline = Date.now() + PORT_RELEASE_MS;
    let open = await portIsOpen('127.0.0.1', localPort);
    while (open && Date.now() < deadline && !stopping) {
      await new Promise((resolve) => setTimeout(resolve, 150));
      open = await portIsOpen('127.0.0.1', localPort);
    }
    if (stopping) return;
    if (open) {
      state.mode = 'external';
      state.external = true;
      state.error = '';
      logger.info(`wechat-agent setup: 127.0.0.1:${localPort} 已被其它隧道占用，直接复用`);
      return;
    }
    server = createServer({ allowHalfOpen: true }, handleConnection);
    server.on('error', (error) => {
      if (stopping) return;
      if (error.code === 'EADDRINUSE' && Date.now() < deadline) {
        // The old tunnel released the port a moment too late; retry the bind.
        try {
          server.close();
        } catch {
          // Not listening yet, nothing to close.
        }
        server = null;
        const retry = setTimeout(() => start().catch(() => {}), 250);
        retry.unref?.();
        return;
      }
      state.mode = 'stopped';
      state.error = `本地端口 ${localPort} 无法监听：${messageOf(error)}`;
      logger.warn(`wechat-agent setup: ${state.error}`);
    });
    server.listen(localPort, '127.0.0.1', () => {
      logger.info(`wechat-agent setup: 隧道 127.0.0.1:${localPort} → 127.0.0.1:${remotePort}`);
      ensureClient().catch(() => {});
    });
  };

  const stop = () => {
    stopping = true;
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
    destroySockets();
    if (server) {
      try {
        server.close();
      } catch {
        // ignore
      }
      server = null;
    }
    if (client) {
      const current = client;
      client = null;
      endSsh(current);
    }
    state.mode = 'stopped';
  };

  /** Re-point the tunnel at a new connection (wizard "connect"/"disconnect"). */
  const restart = async () => {
    if (client) {
      const current = client;
      client = null;
      destroySockets();
      endSsh(current);
    }
    state.mode = 'starting';
    state.error = '';
    state.connectedAt = null;
    if (!server) await start();
    else await ensureClient().catch(() => {});
  };

  return { status, start, stop, restart, ensureClient };
}

/**
 * Run the environment probe on the VM and return a structured snapshot.
 *
 * The probe must be safe to run repeatedly and on a machine with nothing
 * installed yet: every check is `command -v` / `test` style and never writes.
 */
export async function probeRemote(client, connection) {
  const projectDir = connection.projectDir || '~/wechat-agent-linux';
  const port = Number(connection.consolePort) || 8765;
  const script = [
    'set -u',
    'emit() { printf "%s=%s\\n" "$1" "$2"; }',
    `PROJECT=${shellQuote(projectDir)}`,
    'PROJECT="${PROJECT/#\\~/$HOME}"',
    'emit PROBE_OK 1',
    'emit SYS_HOST "$(hostname 2>/dev/null)"',
    'emit SYS_USER "$(id -un)"',
    'emit SYS_HOME "$HOME"',
    'emit SYS_ARCH "$(uname -m)"',
    'if [ -r /etc/os-release ]; then . /etc/os-release; emit SYS_OS "${PRETTY_NAME:-${ID:-unknown}}"; else emit SYS_OS unknown; fi',
    'emit SYS_PYTHON "$(python3 -c "import platform;print(platform.python_version())" 2>/dev/null || echo none)"',
    'emit SYS_MEM_MB "$(awk "/MemTotal/ {print int(\\$2/1024)}" /proc/meminfo 2>/dev/null || echo 0)"',
    'emit SYS_DISK_MB "$(df -Pk "$HOME" 2>/dev/null | awk "NR==2 {print int(\\$4/1024)}")"',
    'if [ -d "$PROJECT" ]; then emit PROJECT_EXISTS 1; else emit PROJECT_EXISTS 0; fi',
    'if [ -f "$PROJECT/deploy/bootstrap-xubuntu.sh" ]; then emit PROJECT_MANAGER 1; else emit PROJECT_MANAGER 0; fi',
    'if [ -x "$PROJECT/.venv/bin/python" ]; then emit PROJECT_VENV 1; else emit PROJECT_VENV 0; fi',
    'if [ -x "$HOME/.venvs/wechat-agent-linux/bin/python" ]; then emit GLOBAL_VENV 1; else emit GLOBAL_VENV 0; fi',
    'if [ -f "$PROJECT/.env" ]; then emit PROJECT_ENV 1; else emit PROJECT_ENV 0; fi',
    'if [ -x /opt/wechat/wechat ] || command -v wechat >/dev/null 2>&1 || command -v weixin >/dev/null 2>&1; then emit WECHAT_INSTALLED 1; else emit WECHAT_INSTALLED 0; fi',
    'if pgrep -u "$(id -u)" -x wechat >/dev/null 2>&1 || pgrep -u "$(id -u)" -x weixin >/dev/null 2>&1; then emit WECHAT_RUNNING 1; else emit WECHAT_RUNNING 0; fi',
    'DATA_DIR=""',
    'if [ -f "$PROJECT/.env" ]; then DATA_DIR="$(sed -n "s/^[[:space:]]*WECHAT_LINUX_DATA_DIR[[:space:]]*=[[:space:]]*//p" "$PROJECT/.env" | tail -n 1 | sed -e "s/^[\\"\\x27]//" -e "s/[\\"\\x27]$//")"; fi',
    'if [ -z "$DATA_DIR" ] || [ ! -d "$DATA_DIR" ]; then DATA_DIR="$(find "$HOME" -maxdepth 4 -type d -name "db_storage" -path "*xwechat_files*" 2>/dev/null | head -n 1 | sed "s|/db_storage$||")"; fi',
    'emit WECHAT_DATA_DIR "$DATA_DIR"',
    'if [ -f "$HOME/.local/state/wechat-agent-linux/graphical-session.env" ]; then emit SESSION_FILE 1; else emit SESSION_FILE 0; fi',
    'if command -v import >/dev/null 2>&1; then emit DEP_MAGICK 1; else emit DEP_MAGICK 0; fi',
    'if command -v xdotool >/dev/null 2>&1; then emit DEP_XDOTOOL 1; else emit DEP_XDOTOOL 0; fi',
    'APT_OK=1',
    'for pkg in python3-venv python3-pip python3-dev build-essential python3-pyatspi gir1.2-gtk-3.0 at-spi2-core; do dpkg -s "$pkg" >/dev/null 2>&1 || APT_OK=0; done',
    'emit DEP_APT "$APT_OK"',
    'if sudo -n true >/dev/null 2>&1; then emit SUDO_PASSWORDLESS 1; else emit SUDO_PASSWORDLESS 0; fi',
    `python3 - ${port} <<'PY' 2>/dev/null || true`,
    'import json, sys, urllib.request',
    'try:',
    '    body = json.load(urllib.request.urlopen("http://127.0.0.1:" + sys.argv[1] + "/api/status", timeout=2))',
    '    print("CONSOLE_OPEN=1")',
    '    print("CONSOLE_PHASE=" + str(body.get("phase", "")))',
    '    print("CONSOLE_THREAD=" + str(body.get("thread_alive", "")))',
    'except Exception:',
    '    print("CONSOLE_OPEN=0")',
    '    print("CONSOLE_PHASE=")',
    'print("PROBE_END=1")',
    'PY',
  ].join('\n');

  const result = await execSsh(client, `bash -c ${shellQuote(script)}`, { timeoutMs: 40_000 });
  if (result.code !== 0 && !result.stdout.includes('PROBE_END=1')) {
    throw new Error(`环境检测失败（退出码 ${result.code}）：${(result.stderr || result.stdout).trim().slice(0, 300)}`);
  }
  const values = new Map();
  for (const line of result.stdout.split(/\r?\n/)) {
    const index = line.indexOf('=');
    if (index <= 0) continue;
    values.set(line.slice(0, index), line.slice(index + 1));
  }
  const flag = (key) => values.get(key) === '1';
  const text = (key) => values.get(key) || '';
  const phase = text('CONSOLE_PHASE');
  return {
    ok: flag('PROBE_OK'),
    error: '',
    at: new Date().toISOString(),
    system: {
      hostname: text('SYS_HOST'),
      os: text('SYS_OS'),
      arch: text('SYS_ARCH'),
      user: text('SYS_USER'),
      home: text('SYS_HOME'),
      python: text('SYS_PYTHON'),
      memoryMb: Number(text('SYS_MEM_MB')) || 0,
      diskFreeMb: Number(text('SYS_DISK_MB')) || 0,
    },
    project: {
      path: projectDir,
      exists: flag('PROJECT_EXISTS'),
      venv: flag('PROJECT_VENV') || flag('GLOBAL_VENV'),
      envFile: flag('PROJECT_ENV'),
      manager: flag('PROJECT_MANAGER'),
    },
    wechat: {
      installed: flag('WECHAT_INSTALLED'),
      running: flag('WECHAT_RUNNING'),
      dataDir: text('WECHAT_DATA_DIR'),
    },
    console: {
      port,
      open: flag('CONSOLE_OPEN'),
      phase: phase || null,
      threadAlive: text('CONSOLE_THREAD') === 'True',
    },
    deps: {
      aptReady: flag('DEP_APT'),
      magick: flag('DEP_MAGICK'),
      xdotool: flag('DEP_XDOTOOL'),
      sessionFile: flag('SESSION_FILE'),
    },
    sudo: { passwordless: flag('SUDO_PASSWORDLESS') },
  };
}

/**
 * Capture the VM's X root window as a PNG data URL.
 *
 * Hand-off users log into WeChat by scanning a QR code on the VM desktop; the
 * wizard renders that screenshot so they never need to open the VM console
 * window. Read-only: `import`/`scrot` only reads the framebuffer.
 */
export async function screenshotRemote(client, connection) {
  const projectDir = connection.projectDir || '~/wechat-agent-linux';
  const script = [
    'set -u',
    `PROJECT=${shellQuote(projectDir)}`,
    'PROJECT="${PROJECT/#\\~/$HOME}"',
    'SESSION="$HOME/.local/state/wechat-agent-linux/graphical-session.env"',
    'if [ -f "$SESSION" ]; then set -a; . "$SESSION"; set +a; fi',
    ': "${DISPLAY:=:0}"',
    ': "${XAUTHORITY:=$HOME/.Xauthority}"',
    'export DISPLAY XAUTHORITY',
    'TMP="$(mktemp /tmp/wechat-agent-shot-XXXXXX.png)" || exit 30',
    'trap "rm -f \\"$TMP\\"" EXIT',
    'if command -v import >/dev/null 2>&1; then import -window root "$TMP" 2>/dev/null || true; fi',
    'if [ ! -s "$TMP" ] && command -v scrot >/dev/null 2>&1; then scrot -o "$TMP" 2>/dev/null || true; fi',
    'if [ -s "$TMP" ]; then base64 -w0 "$TMP"; echo; else echo "__NO_IMAGE__"; fi',
  ].join('\n');
  const result = await execSsh(client, `bash -lc ${shellQuote(script)}`, { timeoutMs: 30_000 });
  const text = result.stdout.trim();
  if (!text || text.includes('__NO_IMAGE__')) {
    throw new Error(
      '没有拿到截图：虚拟机需要运行图形桌面（X11），并已安装 imagemagick 的 import 或 scrot。'
      + '如果虚拟机是纯命令行系统，请直接在 VMware 窗口里登录微信。',
    );
  }
  return `data:image/png;base64,${text.replace(/\s+/g, '')}`;
}
