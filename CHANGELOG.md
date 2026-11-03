# Changelog

## 0.7.0 — 2026-11-03

- 生图和人设不再写死大肥鱼：`personas/<name>/references/speech-style.md` 控制说话风格，`references/image-style.md` 控制自动配图的角色外观。两个文件都是可选的。
- 自定义人设没有 `speech-style.md` 时只得到通用规则，不会收到大肥鱼的口头禅、傲娇示例或语气轮换；没有 `image-style.md` 时自动配图直接关闭，不会偷偷画成内置鲸鱼娘。
- 用户明确说“画一张……”的普通生图仍按用户提示词生成，不受自动配图开关影响。
- 内置大肥鱼的行为保持不变：它的语气和外观已迁移到 `personas/dafeiyu/references/speech-style.md` 和 `image-style.md`。
- 配图缓存按当前人设的图片风格分目录保存，切换人设不会复用旧角色的配图。
- 控制台把“鲸鱼娘配图”改成通用的“角色配图”，并说明参考文件的启用条件。

## 0.6.0 — 2026-11-03

- Renamed the plugin from Weave / `dsh-plugin-wechat-agent` to **Attune** /
  `dsh-plugin-attune`. The visible brand, slot labels, package name, bundle row,
  repository URL and docs now use Attune; the stable `/wechat/*` API namespace
  and the Linux agent source repo keep their existing names.
- Added WeChat discoverability metadata: package keywords, README title and
  search-keyword section, and GitHub repository description/topics covering
  `微信agent`, `微信ai`, `wechatagent`, `wechatai`, `wechat agent`, `wechat ai`,
  `微信机器人` and `微信群助手`.
- Upgrade note: a manual home-level DSH patch row that still uses
  `id: wechat-agent` / `name: dsh-plugin-wechat-agent` must be renamed to
  `id: attune` / `name: dsh-plugin-attune`. Otherwise its `remote_ssh` config is
  ignored and the panel falls back to local mode with a disconnected console.
- No backend or configuration changes; existing VM state is retained. If the
  wizard state was removed, configure the connection again from the deploy page
  or use the home-level `remote_ssh` patch shown in the README.

## 0.5.1 — 2026-11-03

- The overview's "处理队列" counter is now clickable. Its drill-down
  (`GET /wechat/api/queue`) shows claimed messages with conversation, speaker,
  text preview, age, attempt count and reason, plus durable reply jobs waiting
  behind them and recent process-interrupted records.
- Startup now closes stale `reply_records.processing` claims that were left
  behind by a previous agent process. Previously a crash during a send could
  leave the overview's queue counter stuck at 1 forever because the original
  message was never replayed; the row is now marked `failed` with reason
  `processing_interrupted` and listed in the queue drill-down history.

## 0.5.0 — 2026-11-03

- Voice synthesis is no longer tied to Aliyun. `TTS_PROVIDER` now accepts
  `aliyun`, `openai_compatible`, and `elevenlabs`; shared `TTS_BASE_URL` /
  `TTS_API_KEY` fields work across providers while the old Aliyun fields remain
  supported as fallbacks.
- The voice DIY card is capability-driven: providers without cloning hide the
  upload form and offer preset voice buttons plus "试听当前音色"; providers with
  cloning keep the existing upload, preview, refresh, activate and delete flow.
- Profiles remember their provider. Switching provider or model marks old
  profiles as unavailable instead of sending their voice IDs to the wrong API.
- Added `POST /wechat/api/voice/preview-current` for preset/no-clone providers.
- New backend providers: OpenAI-compatible `/v1/audio/speech` (preset voices),
  ElevenLabs TTS with instant cloning, and the existing Aliyun async cloning.

## 0.4.0 — 2026-11-03

- Added a compact "声音 DIY" card to the settings tab: upload a 5–30 second
  single-speaker recording, normalize it to 24 kHz mono PCM, enroll it with
  Qwen-Audio voice cloning, then preview, refresh, activate and delete it.
- Added authenticated console routes for voice profiles and previews. Profiles
  are stored locally under `state/voice-profiles/`; activation writes
  `TTS_VOICE` and reloads/restarts the agent as needed.
- Existing hand-configured custom `TTS_VOICE` values can be imported into the
  DIY list, and profiles created with an older TTS model are marked instead of
  being activated by mistake.
- The plugin proxy now accepts 16 MB request bodies and a 180-second upstream
  timeout for the voice routes, so enrollment does not hit the small status API
  limits.

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
