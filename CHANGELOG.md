# Changelog

## 0.3.8 — 2026-11-03

- Compacted the console shell into one topbar: brand and connection state on the
  left, the six tabs on the right; the separate page heading is gone.
- Rebuilt the overview as a single "RUNNING OVERVIEW" card with one status
  line, three key counters (已回复 / 处理队列 / 异常任务), and the compact switch
  list. Full counters and allowlists now live under "更多数据与白名单".
- Tightened the other five tabs: shorter hints, no duplicate log subtitle, and
  the platform ledger/memories/proactive cards are grouped under one fold.
- Removed the affinity meter bars from the echo list and detail; the affinity
  number remains.

## 0.3.7 — 2026-11-03

- Reordered the console tabs to 概览 / 回声 / 平台 / 设置 / 部署 / 日志, keeping
  setup and diagnostics at the end.

## 0.3.6 — 2026-11-03

- Overview probability rows now show only the percentage (`40%`, or `0%` when
  off). The slim progress bar was removed to keep the status list quieter.

## 0.3.5 — 2026-11-03

- When the plugin is already connected to a VM, the overview now moves the
  "虚拟机与连接" card to the very end of the page. When not connected it stays
  first as onboarding guidance.

## 0.3.4 — 2026-11-03

- Reworked the echo detail header: "← 返回列表" is now a small text link on
  its own line, and the member/group name and metadata start below it instead
  of sharing a flex row with the back button.

## 0.3.3 — 2026-11-03

- Redesigned the overview switch section as a compact status list. Probability
  rows now show only the percentage (`40%`, or `0%` when off), with a small
  progress bar; boolean rows show 开启/关闭.
- Merged the overview "虚拟机与部署" and "连接" cards into one
  "虚拟机与连接" card, removing the duplicate connection card.
- One-click deployments now write the default persona 大肥鱼
  (`personas/dafeiyu/SKILL.md`) into the initial `.env`.

## 0.3.2 — 2026-11-03

- Removed the echo summary from the chat composer dock; echo now lives only on
  the plugin page.
- Added click-through detail views for echo members and groups: profile fields,
  recent events, group atmosphere/interests/memes, style, AI speech style and
  timeline, with a back-to-list action.
- Updated README for the in-page echo workflow.

## 0.3.1 — 2026-11-03

- Public release trimmed to plugin sources; test files and CI workflow removed.
- Added a direct install-to-first-use path and a link to the full Linux Agent
  source repository.
- Added `npm run check` for syntax validation.

## 0.3.0 — 2026-11-03

- DSH-styled operation dialog for all VM connection inputs.
- Beginner onboarding with Ubuntu/Xubuntu 24.04 LTS and VMware Workstation
  download guidance, terminal instructions, and copy/paste tips.
- One-click SSH deploy, environment probe, SSH tunnel and screenshot flow.
- Full control page (overview, deploy, echo, platform, logs, settings) plus a
  compact echo dock.
- Model key, persona file/folder upload, and platform three-way link controls.
- Session persistence in `~/.dsh/wechat-agent-setup.json` with `0600` mode.
- Self-contained source bundle in `assets/wechat-agent-linux-src.tar.gz`.

## Earlier

Initial internal releases for the Linux WeChat agent deployment.
