/**
 * Deterministic, dependency-free tar.gz writer for the plugin's source bundle.
 *
 * The plugin ships the Python project as `assets/wechat-agent-linux-src.tar.gz`
 * so a machine that only has DSH installed can deploy the agent to a VM over
 * SSH without cloning this repository first. `tar` is not invoked: the archive
 * is assembled in memory (ustar + gzip), which keeps the plugin working on
 * Windows, macOS and Linux hosts without extra tools.
 *
 * Only regular files and directories are archived. Symlinks are skipped: the
 * project tree does not use them, and following them could leak files from
 * outside the repository.
 */

import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const BLOCK = 512;

/** Directories and files that never belong in a deployable bundle. */
const DEFAULT_EXCLUDES = [
  '.git/',
  '.venv/',
  '.pytools/',
  '.playwright-mcp/',
  '.pytest_cache/',
  '.mypy_cache/',
  '.ruff_cache/',
  '.idea/',
  'node_modules/',
  '__pycache__/',
  'wechat_agent_linux.egg-info/',
  'artifacts/',
  '.local/',
  'dist/',
  'build/',
  'logs/',
  'state/',
  'tests/',
  'docs/',
  'dsh-plugin-wechat-agent/',
  'deploy/out/',
  'deploy/HANDOVER-REMOTE-TEST.md',
  '.env',
  '.env.from-windows',
  'env.from-windows',
  '.deploy-stage/',
  '.bundle-check/',
  'PRD.md',
  'STATUS.md',
  'wechat-agent-linux-src.tar.gz',
];

const EXCLUDED_SUFFIXES = [
  '.pyc',
  '.pyo',
  '.log',
  '.db',
  '.db-journal',
  '.db-wal',
  '.db-shm',
  '.exe',
  '.whl',
  '.iso',
  '.zip',
  '.7z',
  '.tar',
  '.tar.gz',
  '.tgz',
];
const EXCLUDED_NAMES = new Set(['.DS_Store', 'Thumbs.db']);

/** `true` when a repo-relative POSIX path is excluded from the bundle. */
export function isExcluded(relativePath) {
  const normalized = relativePath.replace(/^\.\/+/, '').replace(/\/+$/, '');
  const path = relativePath.endsWith('/') ? relativePath : `${relativePath}/`;
  const parts = normalized.split('/');
  for (const rule of DEFAULT_EXCLUDES) {
    if (rule.endsWith('/')) {
      const directory = rule.slice(0, -1);
      if (directory.includes('/')) {
        if (path === rule || path.startsWith(rule)) return true;
      } else if (parts.includes(directory)) {
        return true;
      }
    } else if (parts[parts.length - 1] === rule || normalized === rule) {
      return true;
    }
  }
  // pytest's basetemp directory is created in the repository root on Windows
  // when the test suite runs from there; it contains no project source.
  if (parts.some((part) => part.startsWith('pytest-of-'))) return true;
  const baseName = parts[parts.length - 1];
  // Real environment files and their backups (`.env`, `.env.bak-*`,
  // `.env.local`, ...) must never ship; only committed templates are allowed.
  if (baseName.startsWith('.env') && !baseName.endsWith('.example')) return true;
  if (EXCLUDED_NAMES.has(baseName)) return true;
  return EXCLUDED_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

/** Collect `{ path, source }` for every regular file below `root`. */
export function collectFiles(root) {
  const files = [];
  const walk = (directory, prefix) => {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (isExcluded(relative)) continue;
      const absolute = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        walk(absolute, relative);
        continue;
      }
      if (!entry.isFile()) continue;
      files.push({ path: relative, source: absolute });
    }
  };
  walk(root, '');
  return files;
}

function octal(value, width) {
  const text = value.toString(8);
  if (text.length > width - 1) throw new Error(`tar field overflow: ${value} > ${width} octal digits`);
  return `${'0'.repeat(width - 1 - text.length)}${text}\0`;
}

/** Split a path into ustar `name` + `prefix` fields when it exceeds 100 bytes. */
function splitName(path) {
  if (Buffer.byteLength(path) <= 100) return { name: path, prefix: '' };
  for (let index = path.length - 1; index > 0; index -= 1) {
    if (path[index] !== '/') continue;
    const prefix = path.slice(0, index);
    const name = path.slice(index + 1);
    if (Buffer.byteLength(name) <= 100 && Buffer.byteLength(prefix) <= 155) return { name, prefix };
  }
  throw new Error(`path too long for ustar: ${path}`);
}

function headerFor({ path, size, mtime, mode, type = '0', linkname = '' }) {
  const { name, prefix } = splitName(path);
  const header = Buffer.alloc(BLOCK, 0);
  header.write(name, 0, 100, 'utf8');
  header.write(octal(mode, 8), 100, 'ascii');
  header.write(octal(0, 8), 108, 'ascii');
  header.write(octal(0, 8), 116, 'ascii');
  header.write(octal(size, 12), 124, 'ascii');
  header.write(octal(mtime, 12), 136, 'ascii');
  header.write('        ', 148, 8, 'ascii'); // checksum placeholder
  header.write(type, 156, 1, 'ascii');
  header.write(linkname, 157, 100, 'utf8');
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  header.write('root', 265, 32, 'ascii');
  header.write('root', 297, 32, 'ascii');
  header.write(octal(0, 8), 329, 'ascii');
  header.write(octal(0, 8), 337, 'ascii');
  header.write(prefix, 345, 155, 'utf8');
  let checksum = 0;
  for (const byte of header) checksum += byte;
  header.write(`${octal(checksum, 7)} `, 148, 8, 'ascii');
  return header;
}

/**
 * Build the tar.gz buffer for a directory.
 *
 * @param {string} root absolute directory to archive
 * @param {{ mtime?: number, prefix?: string }} [options]
 * @returns {{ buffer: Buffer, files: number, bytes: number, sha256: string }}
 */
export function buildTarball(root, options = {}) {
  const absoluteRoot = resolve(root);
  const mtime = options.mtime ?? Math.floor(Date.now() / 1000);
  const prefix = options.prefix ? options.prefix.replace(/\/+$/, '') : '';
  const files = collectFiles(absoluteRoot);
  const chunks = [];
  let totalBytes = 0;

  for (const file of files) {
    const data = readFileSync(file.source);
    const stat = statSync(file.source);
    const path = prefix ? `${prefix}/${file.path}` : file.path;
    const mode = stat.mode & 0o777 || 0o644;
    chunks.push(headerFor({ path, size: data.length, mtime, mode }));
    chunks.push(data);
    const padding = (BLOCK - (data.length % BLOCK)) % BLOCK;
    if (padding) chunks.push(Buffer.alloc(padding, 0));
    totalBytes += data.length;
  }
  chunks.push(Buffer.alloc(BLOCK * 2, 0));

  const tar = Buffer.concat(chunks);
  const buffer = gzipSync(tar, { level: 9, mtime });
  return {
    buffer,
    files: files.length,
    bytes: totalBytes,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}

/** Convert a Windows path prefix to the POSIX form tar expects (test helper). */
export function toPosix(path) {
  return path.split(sep).join('/');
}
