/**
 * Build the Python-project bundle that the plugin ships for one-click VM deploy.
 *
 * Usage (from `dsh-plugin-wechat-agent/`):
 *
 *   node build/pack-source.mjs
 *
 * Produces:
 *   assets/wechat-agent-linux-src.tar.gz  — the repository tree without secrets,
 *                                            venvs, caches, artifacts or the
 *                                            plugin's own node_modules
 *   assets/env.linux.example              — the `.env` template used to write a
 *                                            fresh VM configuration
 *   assets/BUNDLE.json                    — build metadata shown in the wizard
 *
 * The tarball is committed with the plugin so a hand-off needs no network and
 * no repository checkout on the receiving machine. Re-run this script whenever
 * the Python project changes.
 */

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildTarball } from '../lib/tarball.mjs';

const pluginDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(pluginDir, '..');
const assetsDir = join(pluginDir, 'assets');

if (!/wechat-agent-linux$/.test(repoRoot)) {
  // The plugin lives inside the Python repository; a different parent means the
  // developer is building from an installed copy, which cannot be packaged.
  process.stderr.write(`[错误] 插件上一级不是 wechat-agent-linux 仓库：${repoRoot}\n`);
  process.exit(1);
}

mkdirSync(assetsDir, { recursive: true });

const startedAt = Date.now();
const { buffer, files, bytes, sha256 } = buildTarball(repoRoot);
const tarballPath = join(assetsDir, 'wechat-agent-linux-src.tar.gz');
writeFileSync(tarballPath, buffer);

const envExample = join(repoRoot, '.env.linux.example');
copyFileSync(envExample, join(assetsDir, 'env.linux.example'));

writeFileSync(
  join(assetsDir, 'BUNDLE.json'),
  `${JSON.stringify(
    {
      builtAt: new Date().toISOString(),
      tarball: 'wechat-agent-linux-src.tar.gz',
      sha256,
      files,
      bytes,
      builtInMs: Date.now() - startedAt,
      source: 'wechat-agent-linux',
    },
    null,
    2,
  )}\n`,
);

process.stdout.write(
  `已生成 ${tarballPath}\n`
  + `  文件 ${files} 个，解压后 ${(bytes / 1024 / 1024).toFixed(2)} MB，`
  + `压缩包 ${(buffer.length / 1024).toFixed(0)} KB\n`
  + `  sha256 ${sha256}\n`
  + `  模板 ${join(assetsDir, 'env.linux.example')}\n`,
);
