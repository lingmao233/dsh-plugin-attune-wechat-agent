/**
 * One-click VM setup: connection state, environment probe, deploy jobs, routes.
 *
 * The wizard lives in the WeChat tab (`DeployTab`). It talks to the routes
 * registered here:
 *
 *   GET  /wechat/setup/state       current connection, probe, job
 *   POST /wechat/setup/connect     test SSH + save credentials + start tunnel
 *   POST /wechat/setup/disconnect  forget credentials, stop tunnel
 *   POST /wechat/setup/probe       re-run the read-only environment probe
 *   POST /wechat/setup/run         deploy / update / phase / start-* (async job)
 *   POST /wechat/setup/screenshot  PNG of the VM desktop (QR login helper)
 *
 * Design constraints:
 *
 * - Everything the wizard needs on the VM comes from the repository itself
 *   (`deploy/bootstrap-xubuntu.sh` phases). This module only transports files,
 *   runs those phases and reads the results; it does not re-implement the
 *   installer or the `.env` schema.
 * - Credentials are stored in `$DSH_HOME/wechat-agent-setup.json` (0600). The
 *   alternative — asking a beginner to edit DSH plugin settings and create SSH
 *   keys — is exactly what this wizard exists to avoid. The file never leaves
 *   the DSH machine and `disconnect` removes it.
 * - The Python project is shipped with the plugin as
 *   `assets/wechat-agent-linux-src.tar.gz`; no git access is required on the
 *   target VM and no public repository is implied.
 */

import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  connectSsh,
  createSsh2Tunnel,
  endSsh,
  execSsh,
  probeRemote,
  screenshotRemote,
  shellQuote,
  uploadFileSsh,
  uploadSsh,
} from './remote.mjs';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const ASSET_DIR = resolve(MODULE_DIR, '..', 'assets');
const TARBALL_PATH = join(ASSET_DIR, 'wechat-agent-linux-src.tar.gz');
const ENV_TEMPLATE_PATH = join(ASSET_DIR, 'env.linux.example');
const BUNDLE_META_PATH = join(ASSET_DIR, 'BUNDLE.json');

/** Defaults shown by the wizard; also used when a request omits a field. */
const CONNECTION_DEFAULTS = Object.freeze({
  port: 22,
  username: 'wx',
  projectDir: '~/wechat-agent-linux',
  consolePort: 8765,
  authType: 'password',
});

/** How long a single bootstrap phase may run. pip on a slow mirror is slow. */
const PHASE_TIMEOUT_MS = 20 * 60_000;
/** How long the deploy job may stay silent while uploading. */
const UPLOAD_TIMEOUT_MS = 10 * 60_000;
/** Cap on retained log lines; the UI is a progress view, not an archive. */
const MAX_LOG_LINES = 2_000;

/* ------------------------------------------------------------------ state --- */

/** Where connection state lives. Set `DSH_HOME` to override for tests. */
export function setupHome() {
  const configured = String(process.env.DSH_HOME || '').trim();
  return configured ? resolve(configured) : join(homedir(), '.dsh');
}

/** Absolute path of the persisted wizard state. */
export function setupStateFile(home = setupHome()) {
  return join(home, 'wechat-agent-setup.json');
}

function readJsonFile(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** Persist with 0600; a partial write must never leave a truncated JSON file. */
function writeJsonFile(file, value) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  try {
    chmodSync(temporary, 0o600);
  } catch {
    // Windows ignores POSIX modes; the file is still inside the user profile.
  }
  renameSync(temporary, file);
}

/** Read the persisted connection record, or null when not configured. */
export function loadPersisted(home = setupHome()) {
  const file = setupStateFile(home);
  const data = readJsonFile(file);
  if (!data || typeof data !== 'object') return null;
  const connection = normalizeConnection(data.connection);
  if (!connection) return null;
  return {
    connection,
    savedAt: typeof data.savedAt === 'string' ? data.savedAt : '',
    deployedAt: typeof data.deployedAt === 'string' ? data.deployedAt : '',
    bundleSha: typeof data.bundleSha === 'string' ? data.bundleSha : '',
    lastProbe: data.lastProbe && typeof data.lastProbe === 'object' ? data.lastProbe : null,
    lastDeployAction: typeof data.lastDeployAction === 'string' ? data.lastDeployAction : '',
  };
}

/** Normalize a raw connection record; returns null when it cannot be used. */
export function normalizeConnection(value) {
  if (!value || typeof value !== 'object') return null;
  const host = String(value.host || '').trim().replace(/^ssh:\/\//i, '').replace(/\/+$/, '');
  const username = String(value.username || '').trim();
  if (!host || !username) return null;
  const authType = value.authType === 'key' ? 'key' : 'password';
  const port = clampInteger(value.port, 22, 1, 65535);
  const consolePort = clampInteger(value.consolePort, 8765, 1, 65535);
  return {
    host,
    port,
    username,
    authType,
    password: authType === 'password' ? String(value.password || '') : '',
    privateKeyPath: authType === 'key' ? String(value.privateKeyPath || '~/.ssh/id_ed25519') : '',
    passphrase: authType === 'key' ? String(value.passphrase || '') : '',
    projectDir: String(value.projectDir || CONNECTION_DEFAULTS.projectDir).trim() || CONNECTION_DEFAULTS.projectDir,
    consolePort,
    token: String(value.token || ''),
  };
}

function clampInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(number)));
}

/** Shape returned to the browser: secrets replaced by presence flags. */
export function redactState(persisted, { probe, job, assets, tunnel, external }) {
  const connection = persisted?.connection || null;
  return {
    configured: Boolean(connection),
    connection: connection
      ? {
        host: connection.host,
        port: connection.port,
        username: connection.username,
        authType: connection.authType,
        projectDir: connection.projectDir,
        consolePort: connection.consolePort,
        hasPassword: Boolean(connection.password),
        hasKey: connection.authType === 'key',
        hasPassphrase: Boolean(connection.passphrase),
        savedAt: persisted.savedAt,
      }
      : null,
    // The plugin may already be connected through its own settings
    // (`remote_ssh` / `remote_url`). The browser shows that as "已连接" and can
    // prefill the takeover form from it instead of asking for the VM twice.
    external: external || null,
    deployedAt: persisted?.deployedAt || '',
    bundleSha: persisted?.bundleSha || '',
    assets: assets || null,
    probe: probe || persisted?.lastProbe || null,
    job: job || null,
    tunnel: tunnel || null,
    lastDeployAction: persisted?.lastDeployAction || '',
  };
}

/* -------------------------------------------------------------- jobs ------- */

let jobCounter = 0;

function createJob({ action, title }) {
  jobCounter += 1;
  return {
    id: `job-${Date.now().toString(36)}-${jobCounter}`,
    action,
    title,
    status: 'running',
    log: [],
    error: '',
    startedAt: new Date().toISOString(),
    finishedAt: null,
  };
}

function appendJobLog(job, line) {
  // The bootstrap script prints terminal colors through SSH; the job log is
  // rendered as plain text in the console, so drop the escape sequences.
  const text = String(line || '').replace(/\x1b\[[0-9;]*m/g, '');
  if (!text.trim()) return;
  for (const single of text.split(/\r?\n/)) {
    if (job.log.length >= MAX_LOG_LINES) job.log.shift();
    job.log.push(single.slice(0, 2_000));
  }
}

/* ------------------------------------------------------------ bundle ------- */

/** Metadata for the source bundle shipped inside the plugin. */
export function bundleInfo() {
  const meta = readJsonFile(BUNDLE_META_PATH);
  const exists = existsSync(TARBALL_PATH);
  let sha = meta && typeof meta.sha256 === 'string' ? meta.sha256 : '';
  let bytes = Number(meta?.bytes) || 0;
  if (exists && !sha) {
    sha = createHash('sha256').update(readFileSync(TARBALL_PATH)).digest('hex');
    bytes = statSync(TARBALL_PATH).size;
  }
  return {
    available: exists,
    path: TARBALL_PATH,
    sha256: sha,
    bytes,
    files: Number(meta?.files) || 0,
    builtAt: typeof meta?.builtAt === 'string' ? meta.builtAt : '',
  };
}

/** Read the shipped source bundle (throws a user-facing message when missing). */
export function readBundle() {
  if (!existsSync(TARBALL_PATH)) {
    throw new Error(`插件缺少源码包 ${TARBALL_PATH}；在插件目录运行 node build/pack-source.mjs 重新生成`);
  }
  return readFileSync(TARBALL_PATH);
}

/** The `.env` template shipped with the plugin. */
export function readEnvTemplate() {
  try {
    return readFileSync(ENV_TEMPLATE_PATH, 'utf8');
  } catch {
    throw new Error(`插件缺少 .env 模板 ${ENV_TEMPLATE_PATH}；在插件目录运行 node build/pack-source.mjs 重新生成`);
  }
}

/**
 * Build the VM's initial `.env` from the shipped template plus wizard fields.
 *
 * Only well-known keys are touched; comments stay intact. `WECHAT_ALLOW_SEND`
 * is always written as `false`: the deployer's README treats enabling send as
 * the last manual step after the read path is verified.
 */
export function buildEnvFile(overrides = {}) {
  const template = readEnvTemplate();
  const values = {
    WECHAT_PLATFORM: 'linux',
    WECHAT_LINUX_DATA_DIR: '',
    WECHAT_ACCOUNT_ID: '',
    WECHAT_GROUP_NAMES: '',
    WECHAT_LINUX_CHAT_IDS: '{}',
    WECHAT_ALLOW_SEND: 'false',
    DATABASE_URL: 'sqlite:///state/memory.db',
    DESKTOP_HOST: '127.0.0.1',
    DESKTOP_TOKEN: '',
    LLM_BASE_URL: '',
    LLM_API_KEY: '',
    LLM_MODEL: '',
    ...Object.fromEntries(Object.entries(overrides || {}).map(([key, value]) => [key, String(value ?? '')])),
  };
  const lines = template.split(/\r?\n/).map((line) => {
    const match = /^([ \t]*)(export[ \t]+)?([A-Z0-9_]+)[ \t]*=/.exec(line);
    if (!match) return line;
    const key = match[3];
    if (!(key in values)) return line;
    return `${match[1]}${match[2] || ''}${key}=${quoteEnvValue(values[key])}`;
  });
  const text = lines.join('\n');
  return text.endsWith('\n') ? text : `${text}\n`;
}

function quoteEnvValue(value) {
  const text = String(value ?? '');
  if (text === '') return '';
  if (/[\s#'"]/.test(text)) return `"${text.replace(/"/g, '\\"')}"`;
  return text;
}

/* ------------------------------------------------------- remote helpers ---- */

/** Expand `~/x` against the VM home discovered over SSH. */
export function remotePath(remoteHome, value) {
  const text = String(value || '').trim();
  const home = String(remoteHome || '').replace(/\/+$/, '');
  if (!text) return `${home}/wechat-agent-linux`;
  if (text === '~') return home;
  if (text.startsWith('~/')) return `${home}/${text.slice(2)}`;
  if (text.startsWith('/')) return text;
  return `${home}/${text}`;
}

/** Read the VM's HOME from a live connection. */
async function remoteHomeOf(client) {
  const result = await execSsh(client, 'printf %s "$HOME"', { timeoutMs: 10_000 });
  const home = result.stdout.trim();
  if (!home.startsWith('/')) throw new Error(`无法读取虚拟机主目录：${home || '空输出'}`);
  return home;
}

/** Where the password-reading `sudo` shim lives on the VM. */
function sudoShimDir(remoteHome) {
  return `${remoteHome}/.wechat-agent-tools/bin`;
}

/**
 * Make `sudo` work inside non-interactive SSH commands.
 *
 * OpenSSH without a PTY gives `sudo` no terminal, so `sudo -v` dies with
 * "a terminal is required to read the password". A tiny `sudo` shim in front of
 * `$PATH` adds `-S -p ""` so each call reads the password from the command's
 * piped stdin; the deploy phases then receive enough password lines for every
 * sudo they issue. The password itself is never written to disk or argv.
 *
 * Returns the PATH prefix to use for the deploy commands ('' when the VM
 * already allows passwordless sudo).
 */
async function installSudoShim(client, remoteHome, { password, log }) {
  const passwordless = await execSsh(client, 'sudo -n true >/dev/null 2>&1 && echo SUDO_OK || echo SUDO_NEEDED', { timeoutMs: 15_000 });
  if (passwordless.stdout.includes('SUDO_OK')) {
    log('sudo：免密可用');
    return { binDir: '', password: '' };
  }
  if (!password) {
    throw new Error('虚拟机需要 sudo 密码才能安装系统依赖；请在连接页填写登录密码（通常与 SSH 密码相同），或在部署选项里单独填 sudo 密码');
  }
  const binDir = sudoShimDir(remoteHome);
  const install = [
    `mkdir -p ${shellQuote(binDir)}`,
    `cat > ${shellQuote(`${binDir}/sudo`)} <<'SH'`,
    '#!/bin/sh',
    'exec /usr/bin/sudo -S -p "" "$@"',
    'SH',
    `chmod 755 ${shellQuote(`${binDir}/sudo`)}`,
  ].join('\n');
  const result = await execSsh(client, `bash -lc ${shellQuote(install)}`, { timeoutMs: 30_000 });
  if (result.code !== 0) {
    throw new Error(`安装 sudo 辅助脚本失败：${(result.stderr || result.stdout).trim().slice(0, 300)}`);
  }
  log('sudo：已启用密码授权（仅部署任务使用，密码不落盘）');
  return { binDir, password };
}

/** Piped stdin for the deploy command: one password line per sudo call. */
function sudoStdin(sudo, lines = 6) {
  if (!sudo || !sudo.password) return undefined;
  return `${`${sudo.password}\n`.repeat(lines)}`;
}

/** Shell prefix that puts the sudo shim first in PATH. */
function sudoPathPrefix(sudo) {
  return sudo && sudo.binDir ? `PATH=${shellQuote(sudo.binDir)}:"$PATH" ` : '';
}

/**
 * Run one `bootstrap-xubuntu.sh` phase over the live SSH client.
 *
 * @param {object} options
 * @param {import('ssh2').Client} options.client
 * @param {string} options.projectDir VM project directory
 * @param {string} options.phase bootstrap phase
 * @param {string} [options.envPath] imported .env on the VM
 * @param {string} [options.pipIndex] pip mirror
 * @param {string} [options.wechatDebPath] WeChat .deb staged on the VM
 * @param {boolean} [options.skipApt] skip apt in the base phase
 * @param {{ binDir: string, password: string }|null} [options.sudo] sudo shim state
 * @param {(line: string) => void} options.log progress sink
 */
async function runBootstrapPhase(client, { projectDir, phase, envPath, pipIndex, wechatDebPath, skipApt, sudo, log, timeoutMs = PHASE_TIMEOUT_MS }) {
  const argumentsList = ['bash', 'deploy/bootstrap-xubuntu.sh', '--phase', phase];
  if (envPath) argumentsList.push('--env-from', envPath);
  if (skipApt) argumentsList.push('--skip-apt');
  if (pipIndex) argumentsList.push('--pip-index', pipIndex);
  if (wechatDebPath) argumentsList.push('--wechat-deb', wechatDebPath);
  const command = `cd ${shellQuote(projectDir)} && ${sudoPathPrefix(sudo)}WECHAT_VENV_DIR="$HOME/.venvs/wechat-agent-linux" ${argumentsList.map(shellQuote).join(' ')}`;
  log(`$ ${phase === 'base' ? 'bash deploy/bootstrap-xubuntu.sh --phase base' : `bash deploy/bootstrap-xubuntu.sh --phase ${phase}`}`);
  const result = await execSsh(client, `bash -lc ${shellQuote(command)}`, {
    timeoutMs,
    onLine: (line) => log(line),
    input: sudoStdin(sudo, phase === 'base' ? 6 : 4),
  });
  if (result.timedOut) throw new Error(`阶段 ${phase} 超时（${Math.round(timeoutMs / 60_000)} 分钟）；检查虚拟机网络后重试`);
  return result;
}

/** Where the bundled source tarball and generated env are staged on the VM. */
function stagingPaths(remoteHome) {
  return {
    bundle: `${remoteHome}/.wechat-agent-bundle.tar.gz`,
    env: `${remoteHome}/.wechat-agent-env`,
    wechatDeb: `${remoteHome}/.wechat-agent-wechat.deb`,
  };
}

/**
 * Upload the source bundle and extract it over the project directory.
 * `.env` is not part of the archive, so a redeploy preserves the VM config.
 */
async function deployFiles(client, { connection, remoteHome, bundle, envText, log }) {
  const stage = stagingPaths(remoteHome);
  const projectDir = remotePath(remoteHome, connection.projectDir);
  log(`上传源码包 ${(bundle.length / 1024 / 1024).toFixed(1)} MB → ${stage.bundle}`);
  const uploadStart = Date.now();
  await uploadSsh(client, bundle, stage.bundle);
  log(`上传完成（${((Date.now() - uploadStart) / 1000).toFixed(1)} 秒）`);
  let envPath = '';
  if (envText) {
    log(`写入初始配置 → ${stage.env}`);
    await uploadSsh(client, Buffer.from(envText, 'utf8'), stage.env);
    envPath = stage.env;
  }
  const prepare = [
    `mkdir -p ${shellQuote(projectDir)}`,
    `tar -xzf ${shellQuote(stage.bundle)} -C ${shellQuote(projectDir)}`,
    `test -f ${shellQuote(`${projectDir}/deploy/bootstrap-xubuntu.sh`)}`,
  ].join(' && ');
  const prepared = await execSsh(client, `bash -lc ${shellQuote(prepare)}`, { timeoutMs: UPLOAD_TIMEOUT_MS });
  if (prepared.code !== 0) {
    throw new Error(`解压源码失败（退出码 ${prepared.code}）：${(prepared.stderr || prepared.stdout).trim().slice(0, 300)}`);
  }
  log('源码已解压到项目目录');
  return { projectDir, ...stage, envPath };
}

/** Start/restart the console on the VM and wait for its port. */
async function startConsole(client, { projectDir, consolePort, wechatRunning, remoteHome, log }) {
  const python = `${remoteHome}/.venvs/wechat-agent-linux/bin/python`;
  let command;
  if (wechatRunning) {
    command = `cd ${shellQuote(projectDir)} && bash scripts/restart-desktop.sh --port ${consolePort}`;
    log('启动控制台（复用微信图形会话）');
  } else {
    const startScript = [
      `cd ${shellQuote(projectDir)}`,
      `mkdir -p ${shellQuote(`${remoteHome}/.local/state/wechat-agent-linux`)}`,
      `setsid nohup ${shellQuote(python)} -m wechat_agent desktop --config .env --port ${consolePort} `
        + `>> ${shellQuote(`${remoteHome}/.local/state/wechat-agent-linux/desktop.log`)} 2>&1 &`,
      'echo CONSOLE_STARTED',
    ].join('\n');
    command = `bash -lc ${shellQuote(startScript)}`;
    log('启动控制台（微信还没运行，先起只读控制台）');
  }
  const started = await execSsh(client, command, { timeoutMs: 180_000, onLine: (line) => log(line) });
  if (started.timedOut) throw new Error('启动控制台超时');
  if (started.code !== 0) {
    log(`控制台启动脚本退出码 ${started.code}：${(started.stderr || started.stdout).trim().slice(0, 300)}`);
  }
  const waitScript = [
    'for i in $(seq 1 60); do',
    `  if ${shellQuote(python)} - ${consolePort} <<'PY' >/dev/null 2>&1`,
    'import sys, urllib.request',
    'urllib.request.urlopen("http://127.0.0.1:" + sys.argv[1] + "/api/status", timeout=1)',
    'PY',
    '  then echo CONSOLE_READY; exit 0; fi',
    '  sleep 1',
    'done',
    'echo CONSOLE_TIMEOUT; exit 1',
  ].join('\n');
  const waited = await execSsh(client, `bash -lc ${shellQuote(waitScript)}`, { timeoutMs: 90_000 });
  if (waited.stdout.includes('CONSOLE_READY')) {
    log(`控制台已就绪：127.0.0.1:${consolePort}`);
    return true;
  }
  log('控制台没有在 60 秒内监听端口，稍后到控制台页面点「重新连接」查看状态');
  return false;
}

/** Ask the console to start the agent thread. */
async function startAgent(client, { projectDir, consolePort, remoteHome, log }) {
  const python = `${remoteHome}/.venvs/wechat-agent-linux/bin/python`;
  const script = [
    `cd ${shellQuote(projectDir)}`,
    `${shellQuote(python)} - ${consolePort} <<'PY'`,
    'import sys, urllib.request',
    'from wechat_agent.config import Settings',
    'settings = Settings(_env_file=".env")',
    'token = settings.desktop_token',
    'request = urllib.request.Request(',
    '    f"http://127.0.0.1:{sys.argv[1]}/api/start",',
    '    data=b"", method="POST",',
    '    headers={"Authorization": "Bearer " + token} if token else {},',
    ')',
    'try:',
    '    print(urllib.request.urlopen(request, timeout=120).read().decode("utf-8", "replace")[:400])',
    'except Exception as error:',
    '    print(f"START_FAILED: {error}")',
    '    raise SystemExit(1)',
    'PY',
  ].join('\n');
  const result = await execSsh(client, `bash -lc ${shellQuote(script)}`, { timeoutMs: 180_000, onLine: (line) => log(line) });
  if (result.code !== 0) {
    throw new Error(`启动 Agent 失败：${(result.stdout + result.stderr).trim().slice(0, 300)}`);
  }
  log('Agent 已启动');
}

/** Launch WeChat on the VM desktop (only when it is not already running). */
async function startWechat(client, { projectDir, log }) {
  const script = [
    `cd ${shellQuote(projectDir)}`,
    'DISPLAY="${DISPLAY:-:0}"',
    'XAUTHORITY="${XAUTHORITY:-$HOME/.Xauthority}"',
    'export DISPLAY XAUTHORITY',
    'setsid nohup bash scripts/launch-wechat.sh > "$HOME/.local/state/wechat-agent-linux/launch-wechat.log" 2>&1 &',
    'sleep 3',
    'if pgrep -u "$(id -u)" -x wechat >/dev/null 2>&1 || pgrep -u "$(id -u)" -x weixin >/dev/null 2>&1; then echo WECHAT_STARTED; else echo WECHAT_NOT_STARTED; exit 1; fi',
  ].join('\n');
  const result = await execSsh(client, `bash -lc ${shellQuote(script)}`, { timeoutMs: 60_000, onLine: (line) => log(line) });
  if (!result.stdout.includes('WECHAT_STARTED')) {
    throw new Error(`微信没有启动：${(result.stdout + result.stderr).trim().slice(0, 300)}；登录二维码可以点「查看虚拟机截图」`);
  }
  log('微信窗口已启动；用「查看虚拟机截图」显示二维码后扫码登录');
}

/* ---------------------------------------------------------- HTTP helpers --- */

function sendJson(res, statusCode, payload) {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(payload));
}

function readBody(req, limit = 1_000_000) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > limit) {
        failed = true;
        reject(new Error('请求体过大'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (failed) return;
      try {
        const text = Buffer.concat(chunks, size).toString('utf8').trim();
        resolvePromise(text ? JSON.parse(text) : {});
      } catch (error) {
        reject(new Error(`请求体不是合法 JSON：${error.message}`));
      }
    });
    req.on('error', (error) => {
      if (!failed) reject(error);
    });
  });
}

/* ------------------------------------------------------------- service ----- */

/**
 * Build the setup service.
 *
 * @param {{
 *   logger: { info: Function, warn: Function, error?: Function },
 *   home?: string,
 *   assetDir?: string,
 * }} options
 */
export function createSetupService({ logger, home = setupHome(), onConnectionChange, externalProvider }) {
  let persisted = loadPersisted(home);
  let tunnel = null;
  let activeJob = null;
  let probe = persisted?.lastProbe || null;
  const stateFile = setupStateFile(home);

  /** Notify the host half that the upstream plan must be recomputed. */
  const notifyConnectionChange = () => {
    try {
      onConnectionChange?.();
    } catch (error) {
      logger.warn?.(`wechat-agent setup: 连接状态更新失败：${error.message}`);
    }
  };

  const save = (next) => {
    persisted = next;
    if (next) {
      const payload = {
        version: 1,
        connection: next.connection,
        savedAt: next.savedAt,
        deployedAt: next.deployedAt,
        bundleSha: next.bundleSha,
        lastProbe: next.lastProbe || null,
        lastDeployAction: next.lastDeployAction || '',
      };
      writeJsonFile(stateFile, payload);
    } else {
      try {
        rmSync(stateFile, { force: true });
      } catch {
        // Nothing to remove.
      }
    }
  };

  const externalConnection = () => {
    if (typeof externalProvider !== 'function') return null;
    try {
      const value = externalProvider();
      return value && typeof value === 'object' ? value : null;
    } catch (error) {
      logger.warn?.(`wechat-agent setup: 读取插件连接失败：${error.message}`);
      return null;
    }
  };

  const snapshot = () => redactState(persisted, {
    probe,
    job: activeJob,
    assets: bundleInfo(),
    tunnel: tunnel ? tunnel.status() : null,
    external: externalConnection(),
  });

  const stopTunnel = () => {
    if (!tunnel) return;
    tunnel.stop();
    tunnel = null;
  };

  const ensureTunnel = () => {
    const connection = persisted?.connection;
    if (!connection) {
      stopTunnel();
      return null;
    }
    if (tunnel) return tunnel;
    tunnel = createSsh2Tunnel({
      logger,
      getConnection: () => persisted?.connection || null,
      localPort: connection.consolePort || 8765,
      remotePort: connection.consolePort || 8765,
    });
    tunnel.start().catch((error) => logger.warn?.(`wechat-agent setup: 隧道启动失败：${error.message}`));
    return tunnel;
  };

  /** Open a short-lived client for a wizard operation. */
  const withClient = async (connection, action) => {
    if (!connection) throw new Error('还没有连接虚拟机');
    const client = await connectSsh({ connection, logger });
    try {
      return await action(client, connection);
    } finally {
      endSsh(client);
    }
  };

  const refreshProbe = async (connection) => {
    probe = await withClient(connection, (client) => probeRemote(client, connection));
    if (persisted) save({ ...persisted, lastProbe: probe });
    return probe;
  };

  const setJob = (job, updater) => {
    updater(job);
    return job;
  };

  const finishJob = (job, error) => {
    job.finishedAt = new Date().toISOString();
    if (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      appendJobLog(job, `[失败] ${job.error}`);
      logger.warn?.(`wechat-agent setup: ${job.action} 失败：${job.error}`);
    } else {
      job.status = 'done';
    }
  };

  /* -------------------------------------------------------- deploy job ----- */

  const runDeployJob = async (job, options) => {
    const connection = persisted?.connection;
    if (!connection) throw new Error('还没有连接虚拟机');
    const log = (line) => appendJobLog(job, line);
    const action = options.action;
    let client;
    let stagedEnv = '';
    try {
      log(`连接 ${connection.username}@${connection.host}:${connection.port}`);
      client = await connectSsh({ connection, logger });
      log('SSH 已连接');
      const remoteHome = await remoteHomeOf(client);
      log(`虚拟机主目录：${remoteHome}`);
      const currentProbe = await probeRemote(client, connection).catch((error) => {
        log(`环境检测失败（继续部署）：${error.message}`);
        return null;
      });
      if (currentProbe) {
        log(`系统：${currentProbe.system.os} / ${currentProbe.system.arch} / Python ${currentProbe.system.python}`);
        log(`微信：${currentProbe.wechat.installed ? (currentProbe.wechat.running ? '已安装且正在运行' : '已安装未运行') : '未安装'}`);
      }
      const isUpdate = action === 'update' || Boolean(currentProbe?.project?.venv && currentProbe?.project?.envFile);
      const shouldWriteEnv = !isUpdate && !currentProbe?.project?.envFile;
      const envText = shouldWriteEnv ? buildEnvFile(options.env) : '';
      const bundle = readBundle();
      log(`源码包 ${(bundle.length / 1024 / 1024).toFixed(1)} MB，sha256 ${bundleInfo().sha256.slice(0, 12)}…`);
      const files = await deployFiles(client, { connection, remoteHome, bundle, envText, log });
      stagedEnv = files.envPath || '';

      const sudoPassword = options.sudoPassword || (connection.authType === 'password' ? connection.password : '');
      const sudo = await installSudoShim(client, remoteHome, { password: sudoPassword, log });

      let wechatDebPath = '';
      if (options.wechatDebPath) {
        const local = String(options.wechatDebPath.trim());
        if (!existsSync(local)) throw new Error(`找不到微信安装包 ${local}`);
        log(`上传微信安装包 ${local}`);
        wechatDebPath = files.wechatDeb;
        await uploadFileSsh(client, local, wechatDebPath);
        log('微信安装包已上传');
      }

      const skipApt = currentProbe?.deps?.aptReady === true;
      const baseArguments = {
        projectDir: files.projectDir,
        phase: 'base',
        envPath: files.envPath || '',
        pipIndex: String(options.pipIndex || '').trim(),
        wechatDebPath,
        skipApt,
        sudo,
        log,
      };
      if (skipApt) log('系统依赖已就绪，跳过 apt');
      const base = await runBootstrapPhase(client, baseArguments);
      if (base.code !== 0) {
        const detail = (base.stderr || base.stdout).trim().slice(-600);
        throw new Error(`基础环境安装失败（退出码 ${base.code}）：${detail}`);
      }
      log('基础环境完成');

      const runningWechat = async () => {
        const fresh = await probeRemote(client, connection).catch(() => null);
        return Boolean(fresh?.wechat?.running);
      };
      const hasWechat = await runningWechat();

      if (action === 'deploy') {
        if (hasWechat) {
          for (const phase of ['agent', 'key']) {
            try {
              const result = await runBootstrapPhase(client, { projectDir: files.projectDir, phase, sudo, log });
              if (result.code !== 0) log(`阶段 ${phase} 未通过（退出码 ${result.code}），可稍后在部署页重试`);
            } catch (error) {
              log(`阶段 ${phase} 失败：${error.message}`);
            }
          }
        } else {
          log('微信还没运行：先安装/登录微信，再在部署页点「自动识别账号」「扫描数据库密钥」');
        }
        try {
          await runBootstrapPhase(client, { projectDir: files.projectDir, phase: 'autostart', sudo, log });
        } catch (error) {
          log(`开机自启未安装：${error.message}`);
        }
      }

      if (options.restartConsole !== false) {
        await startConsole(client, {
          projectDir: files.projectDir,
          consolePort: connection.consolePort,
          wechatRunning: hasWechat,
          remoteHome,
          log,
        });
      }

      try {
        const result = await runBootstrapPhase(client, {
          projectDir: files.projectDir,
          phase: 'check',
          sudo,
          log,
        });
        if (result.code !== 0) log('自检还有未通过项，详见上面的日志');
      } catch (error) {
        log(`自检未完成：${error.message}`);
      }

      const freshProbe = await probeRemote(client, connection).catch(() => null);
      if (freshProbe) {
        probe = freshProbe;
        log(`最终状态：控制台${freshProbe.console.open ? `在线（${freshProbe.console.phase || '未知阶段'}）` : '未在线'}`);
      }
      save({
        ...persisted,
        connection,
        deployedAt: new Date().toISOString(),
        bundleSha: bundleInfo().sha256,
        lastProbe: probe,
        lastDeployAction: action,
      });
      log('部署流程结束');
    } finally {
      if (stagedEnv && client) {
        // The staged env copy holds model keys; the real one now lives in the
        // project directory (mode 600), so remove the staging copy even if the
        // phase failed halfway through.
        try {
          await execSsh(client, `rm -f ${shellQuote(stagedEnv)}`, { timeoutMs: 10_000 });
          log('已清理临时配置文件');
        } catch {
          /* best effort */
        }
      }
      endSsh(client);
    }
  };

  const runPhaseJob = async (job, options) => {
    const connection = persisted?.connection;
    if (!connection) throw new Error('还没有连接虚拟机');
    const log = (line) => appendJobLog(job, line);
    let client;
    try {
      client = await connectSsh({ connection, logger });
      const remoteHome = await remoteHomeOf(client);
      const projectDir = remotePath(remoteHome, connection.projectDir);
      const phase = String(options.phase || '');
      if (!['agent', 'key', 'check', 'autostart'].includes(phase)) throw new Error(`不支持的阶段：${phase}`);
      const sudoPassword = options.sudoPassword || (connection.authType === 'password' ? connection.password : '');
      const sudo = phase === 'key' ? await installSudoShim(client, remoteHome, { password: sudoPassword, log }) : null;
      const result = await runBootstrapPhase(client, { projectDir, phase, sudo, log });
      if (result.code !== 0) throw new Error(`阶段 ${phase} 退出码 ${result.code}；看上面的日志定位原因`);
      const freshProbe = await probeRemote(client, connection).catch(() => null);
      if (freshProbe) {
        probe = freshProbe;
        save({ ...persisted, lastProbe: freshProbe });
      }
      log(`阶段 ${phase} 完成`);
    } finally {
      endSsh(client);
    }
  };

  const runSimpleJob = async (job, options) => {
    const connection = persisted?.connection;
    if (!connection) throw new Error('还没有连接虚拟机');
    const log = (line) => appendJobLog(job, line);
    let client;
    try {
      client = await connectSsh({ connection, logger });
      const remoteHome = await remoteHomeOf(client);
      const projectDir = remotePath(remoteHome, connection.projectDir);
      const action = options.action;
      if (action === 'start-console') {
        const fresh = await probeRemote(client, connection).catch(() => null);
        await startConsole(client, {
          projectDir,
          consolePort: connection.consolePort,
          wechatRunning: Boolean(fresh?.wechat?.running),
          remoteHome,
          log,
        });
      } else if (action === 'start-wechat') {
        const fresh = await probeRemote(client, connection).catch(() => null);
        if (fresh?.wechat?.running) {
          log('微信已经在运行；二维码请直接点「查看虚拟机截图」');
        } else {
          await startWechat(client, { projectDir, log });
        }
      } else if (action === 'start-agent') {
        await startAgent(client, { projectDir, consolePort: connection.consolePort, remoteHome, log });
      } else {
        throw new Error(`不支持的启动动作：${action}`);
      }
      const freshProbe = await probeRemote(client, connection).catch(() => null);
      if (freshProbe) {
        probe = freshProbe;
        save({ ...persisted, lastProbe: freshProbe });
      }
    } finally {
      endSsh(client);
    }
  };

  const startJob = (options) => {
    if (activeJob && activeJob.status === 'running') {
      return { ok: false, error: '已有一个部署任务在运行，等它结束再操作' };
    }
    const action = String(options.action || 'deploy');
    const titles = {
      deploy: '一键部署到虚拟机',
      update: '更新虚拟机代码并重启控制台',
      phase: `执行阶段 ${options.phase || ''}`,
      'start-console': '启动控制台',
      'start-wechat': '启动微信',
      'start-agent': '启动 Agent',
    };
    const job = createJob({ action, title: titles[action] || action });
    activeJob = job;
    const runner = action === 'deploy' || action === 'update'
      ? runDeployJob
      : action === 'phase'
        ? runPhaseJob
        : runSimpleJob;
    setImmediate(() => {
      runner(job, options)
        .then(() => finishJob(job, null))
        .catch((error) => finishJob(job, error));
    });
    return { ok: true, jobId: job.id };
  };

  /* ----------------------------------------------------------- routes ----- */

  const handle = async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const suffix = url.pathname.replace(/^\/wechat\/setup/, '');
    const method = req.method || 'GET';
    try {
      if (method === 'GET' && (suffix === '/state' || suffix === '')) {
        sendJson(res, 200, snapshot());
        return;
      }
      if (method === 'POST' && suffix === '/connect') {
        const body = await readBody(req);
        const connection = normalizeConnection({
          ...CONNECTION_DEFAULTS,
          ...body,
          password: body.authType === 'key' ? '' : body.password,
        });
        if (!connection) {
          sendJson(res, 200, { ok: false, error: '虚拟机和用户名不能为空' });
          return;
        }
        try {
          const tested = await withClient(connection, async (client) => {
            const remoteHome = await remoteHomeOf(client);
            const remoteProbe = await probeRemote(client, connection).catch((error) => {
              logger.warn?.(`wechat-agent setup: 环境检测失败：${error.message}`);
              return null;
            });
            return { remoteHome, remoteProbe };
          });
          save({
            connection,
            savedAt: new Date().toISOString(),
            deployedAt: persisted?.deployedAt || '',
            bundleSha: persisted?.bundleSha || '',
            lastProbe: tested.remoteProbe,
            lastDeployAction: persisted?.lastDeployAction || '',
          });
          probe = tested.remoteProbe;
          stopTunnel();
          // Let the host half switch plans first: it stops its own `remote_ssh`
          // tunnel, then re-opens this one through `ensureTunnel()`. Waiting for
          // the old listener to leave the loopback port avoids reusing it.
          notifyConnectionChange();
          ensureTunnel();
          logger.info(`wechat-agent setup: 已连接 ${connection.username}@${connection.host}（${connection.authType}）`);
          notifyConnectionChange();
          sendJson(res, 200, { ok: true, state: snapshot() });
        } catch (error) {
          sendJson(res, 200, { ok: false, error: error.message });
        }
        return;
      }
      if (method === 'POST' && suffix === '/disconnect') {
        stopTunnel();
        save(null);
        probe = null;
        notifyConnectionChange();
        sendJson(res, 200, { ok: true, state: snapshot() });
        return;
      }
      if (method === 'POST' && suffix === '/probe') {
        const connection = persisted?.connection;
        if (!connection) {
          sendJson(res, 200, { ok: false, error: '还没有连接虚拟机' });
          return;
        }
        try {
          await refreshProbe(connection);
          sendJson(res, 200, { ok: true, state: snapshot() });
        } catch (error) {
          probe = { ...(probe || {}), ok: false, error: error.message, at: new Date().toISOString() };
          sendJson(res, 200, { ok: false, error: error.message, state: snapshot() });
        }
        return;
      }
      if (method === 'POST' && suffix === '/run') {
        if (!persisted?.connection) {
          sendJson(res, 200, { ok: false, error: '还没有连接虚拟机' });
          return;
        }
        const body = await readBody(req);
        const result = startJob(body);
        sendJson(res, 200, result.ok ? { ok: true, jobId: result.jobId, state: snapshot() } : result);
        return;
      }
      if (method === 'POST' && suffix === '/screenshot') {
        const connection = persisted?.connection;
        if (!connection) {
          sendJson(res, 200, { ok: false, error: '还没有连接虚拟机' });
          return;
        }
        try {
          const image = await withClient(connection, (client) => screenshotRemote(client, connection));
          sendJson(res, 200, { ok: true, image, at: new Date().toISOString() });
        } catch (error) {
          sendJson(res, 200, { ok: false, error: error.message });
        }
        return;
      }
      sendJson(res, 404, { error: 'not_found' });
    } catch (error) {
      logger.warn?.(`wechat-agent setup: ${error.message}`);
      sendJson(res, 500, { ok: false, error: error.message });
    }
  };

  return {
    handle,
    stateFile,
    getConnection: () => persisted?.connection || null,
    getToken: () => persisted?.connection?.token || '',
    getProbe: () => probe,
    snapshot,
    status: () => (tunnel ? tunnel.status() : null),
    ensureTunnel,
    stop: () => stopTunnel(),
    setJob: (job) => {
      activeJob = job;
    },
  };
}
