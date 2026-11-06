# Changelog

## 0.8.3 — 2026-11-06

- 重新打包内置源码（146 个文件）：同步 Python 端近期全部修复。
- 记忆检索改为「默认 RAG 召回 + 规划器一次调用决定注入」：不再依赖关键词命中；「我早上跟你说啥了」「告诉烛火为什么」这类问法能召回事实与原话，闲聊不会注入无关记录。
- @ 召唤修复：消息中间、末尾的 @ 现在也能叫醒机器人（此前只有开头 @ 生效）。
- 引用归属修复：群友引用机器人自己的话时，提示词会标记 isSelf；机器人不再回答「那句不是我发的」，会把被引用的话当成自己说过的。
- 回复可靠性：修复回复尾部 JSON 泄漏；强化说话人归属与反编造（找不到自己说过的原话时，不顺着群友转述编「我早上叫你多喝水」）。
- 语音：微信转文字没有结果时，默认用已保存的语音调用一次阿里云 ASR 兜底（VOICE_FALLBACK_PROVIDER=aliyun，可设 none 关闭）。
- 画像 / 时间线提示词补充北京时间与相对时间；被夸和「哼」口头禅的人设表达收紧。
- 一键部署 env.linux.example 模板同步 VOICE_FALLBACK_PROVIDER 等新配置。

## 0.8.2 — 2026-11-04

- 重新打包内置源码：主动插话不再只接最后半句。同一个人连续发几条短消息时，会把相邻的几条合并成一次发言再回复（例如「奖励是可以追zls」+「还有俩包苹果干」会当成一整段来理解），认领判断也按整段判断。
- 主动插话提示词补上话题衔接要求：本条只是补充、转折或接话时，要结合同一群友前几句和刚发生的话题回应，不能只抠最后一句的字面内容。
- 新增可选开关 `PROACTIVE_BLOCK_ENABLED`（默认开启）、`PROACTIVE_BLOCK_GAP_SECONDS`（默认 60 秒）、`PROACTIVE_BLOCK_MAX_MESSAGES`（默认 3 条，含触发消息）；不改也能生效，一键部署模板已补充说明。
- 不改变普通 @ / 关键词回复的上下文逻辑；回复记录里的 `speech_block` 会记下这次合并了哪几条消息，便于以后排查。

## 0.8.1 — 2026-11-04

- 重新打包内置源码：包含群聊「回复前认领判断」（主动插话和关键词命中时先判断消息在跟谁说话，回其他真人的消息不再接成对自己的指责；不确定时只旁观接话）和手机拼音同音字容错（飞鱼/肥鱼、小宇/小鱼等）；`ADDRESSEE_GATE_ENABLED`（常用 → 回复偏好，默认开启）与 `ADDRESSEE_JUDGE_TIMEOUT_SECONDS`（高级 → 主动参与，默认 8 秒）。
- 一键部署生成的 `.env` 模板补上这两个开关，新装虚拟机默认开启认领判断。
- 设置页：新增「回复偏好」里的认领判断开关和「主动参与」里的判定超时；字段总数更新为 221 项（26 项常用 + 高级折叠）。
- 设置页交互沿用开发版整理：顶部分类工具栏（常用/高级切换、保存、重置，随内容滚动离开）、单分类展示并带未保存计数；「人设工作区」把 AI 设计和文件上传合并为可切换面板；「声音 DIY」卡片紧随其后。
- 源码打包器补上忽略规则：`.env.bak-*` 等真实环境文件和备份、临时目录不再进入内置源码包。

## 0.8.0 — 2026-11-03

- 设置页新增「人设设计」：输入角色描述后，用当前文字模型生成 `SKILL.md`，并可按勾选生成可选的 `references/speech-style.md`（说话风格）和 `references/image-style.md`（自动配图外观）；生成结果可预览修改，再上传并切换人设。
- 设计提示词不读取当前人设，换角色不会继承大肥鱼的语气或外观；未勾选的风格文件不会创建，也不会被任何内置角色替代。
- 人设上传自动把根目录散放的 `speech-style.md` / `image-style.md` 归到 `references/`，格式自动匹配运行时；不提供文件时仍不注入对应风格。
- 人设上传与设计卡片都会提示两个可选文件的用途、缺失时的行为，以及“切换人设不继承大肥鱼”。

## 0.7.2 — 2026-11-03

- 自定义人设的群画像 `reply_examples` 后处理也改为中性词：自定义人设不会再在示例里出现“本鱼是鲸鱼娘”；内置大肥鱼继续保留原行为。
- 重新打包内置源码（0.7.1 之后的人设输出修复已包含）。

## 0.7.1 — 2026-11-03

- 修复切换自定义人设后，遗留的 `PERSONA_SOURCE_URL` 仍指向大肥鱼仓库时，输出后处理继续使用大肥鱼替换词的问题。现在只按人设名或 `PERSONA_FILE` 路径识别内置大肥鱼，自定义人设保持中性。
- 重新打包内置源码，包含自定义人设的图片方案兜底提示词修复：强制配图重试时使用当前人设的 `image-style.md`，不再写死蓝色鲸鱼娘。

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
