# dsh-plugin-wechat-agent

把微信 Agent 接入 DeepSeek Harness（DSH）桌面端。host 半在 DSH 的 HTTP 服务上挂载同源 `/wechat/api/*` 代理、`/wechat/health` 状态探针和 `/wechat/setup/*` 一键部署接口；client 半提供两层界面：一个完整的控制台页面（会话顶部「微信」标签页，同时是设置里的「微信 Agent」分节），以及聊天输入框上方一行随手可看的「回声」摘要。

> 开源 MIT。把微信 Agent 部署到一台 Ubuntu / Xubuntu 24.04 LTS 虚拟机，再从 DSH 里连接、配置和控制。请只使用**专用测试微信号**，不要用主号。

插件有四种模式：

- **一键部署模式（推荐给非技术用户）**：在页面「部署」子页点「一键连接」打开 DSH 风格操作页 → 在操作页点「复制命令」到虚拟机终端粘贴运行（自动装 SSH 并打印连接码）→ 把连接码粘回操作页、输入开机密码点「一键连接」。插件用内置的 `ssh2` 连接虚拟机、上传内置源码包、自动安装依赖、创建 Python 环境、写入初始 `.env`、启动控制台，并维持自己的 SSH 隧道。不需要用户自己拿命令行部署、查 IP 或预先配 SSH 密钥；
- **SSH 隧道模式**：在 DSH 插件设置里填 `remote_ssh`，例如 `wx@192.168.1.50`。插件自己维持 `ssh -N -L 127.0.0.1:8765:127.0.0.1:8765`，主机 DSH 直接读取虚拟机状态；虚拟机控制台继续只监听 loopback，不用对外暴露端口；
- **远程直连模式**：填 `remote_url`，例如 `http://192.168.1.50:8765`（前提是控制台已监听该地址）。主机 DSH 直接读那台机器，插件不启动任何本地进程；
- **本地模式**：两个都留空，插件按 `desktop_host` / `desktop_port` 启动并管理 `python -m wechat_agent desktop` 子进程。

优先级是「部署页保存的虚拟机连接」> `remote_ssh` > `remote_url` > 本地。已经用 `remote_ssh` 手工配好的环境升级后行为不变；一旦在部署页连接过虚拟机，就由部署页接管连接（想退回，点「断开」即可）。

控制台页面沿用 DSH 主题变量，六个子页为「概览、部署、回声、平台、日志、设置」：概览可直接启动 / 停止 / 清除停机标记并查看开关、统计与隧道状态；部署是一键连接 / 检测 / 安装 / 启动微信 / 配置的五步向导；回声是成员画像与群像；平台是抖音/小红书账号状态、三号互联关联、浏览与评论、动作台账、共享记忆与主动浏览；日志是事件流、回复账本与发送审计；设置读写虚拟机 `.env`（216 项，常用 25 项，高级折叠）。

## 环境要求

- DeepSeek Harness 桌面端（带 `webServer` 的 desktop profile）；
- Node.js `^22.19.0` 或 `>=24`；
- 一台 Ubuntu / Xubuntu 24.04 LTS 的 X11 虚拟机（VMware Workstation 17 或其它）；
- 一个**专用测试微信号**，不要用主号。

## 安装

本仓库就是插件源码。本地路径安装会以 `link:` 链接进 profile，因此先安装插件自身声明的依赖（DSH 包由宿主提供，`--omit=peer` 避免把 React 和 cordis 装第二份）：

```powershell
git clone https://github.com/lingmao233/dsh-plugin-wechat-agent.git
cd dsh-plugin-wechat-agent
npm ci --omit=peer
dsh plugin --profile desktop add "C:\path\to\dsh-plugin-wechat-agent"
```

`dsh plugin ... add` 里的路径换成你克隆下来的**绝对路径**（在 PowerShell 里可用 `(Get-Location).Path` 查看当前目录）。也可以在 DSH 插件页面按本地目录安装，然后重启 DSH。修改插件代码后同样需要重启；没有 HMR 时按 DSH 提示操作。

安装后不必单独启动控制台。SSH 隧道和远程模式下控制台本来就在虚拟机上跑；本地模式下若配置端口已有手动启动的控制台，代理会复用它，但该进程不由插件管理。

## 安装后怎么用（最短路径）

1. 打开任意会话，点顶部「对话 / 轨迹 / 微信 / 设计」中的「微信」，再切到「部署」；
2. 点「一键连接」，按弹窗提示在虚拟机终端运行一行命令，把打印的 `WECHAT-VM-CODE:...` 和开机密码填回弹窗，点「一键连接」；
3. 点「一键部署到虚拟机」，等日志执行完；点「启动微信」并「查看虚拟机截图」扫码登录；
4. 回到「概览」点「启动」；之后在「设置」里确认群、模型和发送开关。

> 插件安装包里已经带好 Linux Agent 的预构建源码包，安装后一键部署**不需要**再联网拉取另一个仓库。完整可浏览的 Agent 源码在 [wechat-agent-linux](https://github.com/lingmao233/wechat-agent-linux)。

## Agent 源码

完整的 Linux Agent/Python 控制台源码单独公开：

<https://github.com/lingmao233/wechat-agent-linux>

插件使用 `assets/wechat-agent-linux-src.tar.gz` 作为离线部署包；这个 tarball 就是由上面的源码仓库构建出来的。只想安装使用，不需要手动下载源码仓库。

## 打开控制台

装进 `desktop` profile 后有两个入口，任选其一：

- **会话顶部标签页**：打开任意一个已有会话，标题下方就是 `对话 / 轨迹 / 微信 / 设计` 这一排，点「微信」。它和对话、轨迹同级，切走不会丢会话；
- **设置分节**：点左下角账号头像 → 「设置」（或 `Ctrl + Alt + ,`），左侧导航新增「微信 Agent」。新会话、没有会话时也能从这里进。

两个入口渲染同一个页面，页面内再分「概览 / 部署 / 回声 / 平台 / 日志 / 设置」六个子页。插件已经装进 `desktop` profile 时不需要再做什么；只改了 `lib/client.js` 的话，刷新一次页面（Ctrl+R）就会加载新前端。改了 `index.mjs` / `lib/*.mjs` 的 host 半后，重载插件即可生效（DSH 会监听 `~/.dsh/cordis.patch.yml`：改动该文件保存一次，插件会重新加载；也可以重启 DSH）。

输入框上方的「回声」一行是摘要式快捷视图：收起时只显示「18 位成员 · 3 个群 · 隧道 · 运行中」，点整行展开成员画像 / 群像，不占对话正文。

## 一键部署（「部署」子页）

给别人的虚拟机用，只需要页面上的五步，不用命令行：

**小白一键连接（推荐，3 步，不用查 IP）**：部署页第 1 步只放一个「一键连接」按钮；点它会打开 DSH 风格的操作弹窗，复制命令、粘贴连接码、输密码都在弹窗里完成。弹窗使用 DSH 的 `--dsw-*` 设计变量（背景/边框/圆角/阴影/主题色），自动跟随亮色和暗色主题；手动填写和详细排查也收在弹窗的两个链接里，不会默认铺开解释。

1. 在操作弹窗里点「复制命令」（或手动复制下面这行），到虚拟机桌面打开终端，右键粘贴后回车。SSH 已经在运行就直接打印连接码；没装 SSH 才需要按提示输入一次虚拟机登录密码：
   ```bash
   if systemctl is-active --quiet ssh; then echo "WECHAT-VM-CODE:$(whoami)@$(hostname -I | awk '{print $1}'):22"; else sudo apt-get update -qq || true; sudo apt-get install -y -qq openssh-server && sudo systemctl enable --now ssh; sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config; sudo systemctl restart ssh; command -v ufw >/dev/null && sudo ufw allow 22/tcp >/dev/null 2>&1 || true; echo "WECHAT-VM-CODE:$(whoami)@$(hostname -I | awk '{print $1}'):22"; fi
   ```
2. 命令结束会打印一行 `WECHAT-VM-CODE:用户名@IP:22`，把这一整行复制。
3. 粘回操作弹窗的「连接码」输入框，再输入虚拟机登录密码，点「一键连接」——IP、用户名、端口都会自动填好，插件会自己检测环境。按 Esc、点右上角 ×、点遮罩或「取消」都能关闭弹窗；连接进行中会暂时锁住关闭，避免中途丢失进度。

**命令跑完还是连不上？** 再按这 4 项排查（操作弹窗的「连不上？展开排查说明」里也有）：

| 检查项 | 在虚拟机里怎么看 |
|---|---|
| 虚拟机 IP | 终端运行 `hostname -I`，取第一个地址（形如 `192.168.1.50`）；Windows 这边不要填 `127.0.0.1` |
| SSH 用户名 / 密码 | 用户名运行 `whoami`；密码就是开机登录密码。部署时验证 `sudo` 也要用它，两者一致时「sudo 密码」可以留空 |
| SSH 服务 | `systemctl status ssh` 应为 `active (running)`；关过密码登录的要设 `PasswordAuthentication yes` 并重启 ssh；开了 ufw 需放行 22 端口 |
| 从 Windows 先试连 | 按 `Win+R` 输入 `cmd`，运行 `ssh 用户名@虚拟机IP`，能输入密码并登录 |

虚拟机网络：插件和虚拟机在同一台 Windows 上时，VMware 默认 NAT 就能连；要让别的电脑连，再改桥接或做 22 端口转发。SSH 端口不是 22 的填实际端口。

**虚拟机里还没装 Ubuntu？** 这套方案不能直接用在 Windows / macOS 虚拟机，必须是 **Ubuntu / Xubuntu 24.04 LTS（X11 桌面）**。从零装：

1. 装 VMware Workstation 17.6.1：<https://pan.quark.cn/s/3f0e0687094d>，下载 `VMware-workstation-17.6.1-24319023.exe` 后双击安装（提示重启就先保存工作再重启；链接打不开就复制分享内容 `/~69743c2dbC~:/` 打开夸克 APP）；
2. 下系统镜像：推荐 <https://xubuntu.org/release/24.04/>（Xubuntu 24.04 LTS，轻量），也可以 <https://releases.ubuntu.com/24.04/>（Ubuntu Desktop 24.04 LTS）；认准 24.04 LTS、64-bit/amd64，不要 ARM / Server；
3. VMware 里「创建新的虚拟机」→ 典型 → 安装程序光盘映像文件（ISO）→ 选刚下的 ISO → 客户机 Linux / Ubuntu 64 位 → 磁盘 40 GB → 自定义硬件：内存 8192 MB、处理器 4、网络 NAT → 完成并开启；安装时用户名建议 `wx`；
4. 打开终端：按 `Ctrl + Alt + T`；或左上角“应用程序菜单”搜“终端 / Terminal”；或桌面空白处右键“在此处打开终端”；
5. 粘贴命令：终端里右键 →“粘贴”（或 `Ctrl + Shift + V`），按回车；提示 `[sudo] password for 你的用户名:` 时输入开机密码，屏幕不显示字符是正常的；
6. 复制连接码：鼠标选中 `WECHAT-VM-CODE:...` 整行，右键“复制”（或 `Ctrl + Shift + C`），再粘回操作页。

完整步骤（VMware 下载安装、新建虚拟机、终端打开方式、粘贴和复制）在操作弹窗第 1 步的可折叠教程里，不依赖外部文档。

1. **连接虚拟机**：默认走上面的小白 3 步，所有输入都在操作弹窗内；也可以在弹窗里切到「手动填写 IP / 端口 / 用户名」，或改用 SSH 私钥。点「一键连接」，插件会用内置的 `ssh2` 测试连接、读取系统信息，并把连接信息保存在本机 `~/.dsh/wechat-agent-setup.json`（权限 0600，`断开` 时删除）；
2. **环境检测**：连接成功后自动检测系统、Python、项目、微信、控制台、sudo 与磁盘，结果用勾选清单展示，随时可以「重新检测」；
3. **一键部署**：点「一键部署到虚拟机」。插件会上传内置源码包（`assets/wechat-agent-linux-src.tar.gz`，无需目标机装 git），解压到项目目录，然后按 `deploy/bootstrap-xubuntu.sh --phase base` 安装系统依赖、创建 venv、导入初始 `.env` 并启动控制台。部署日志在页面下方实时滚动；已有部署时按钮变为「更新代码并重启控制台」，不会覆盖 `.env`、数据库和微信数据；
4. **微信登录与配置**：点「启动微信」后点「查看虚拟机截图」，用手机扫二维码登录；之后可依次执行「自动识别账号」「扫描数据库密钥」「完整自检」「安装开机自启」。截图功能只读取虚拟机桌面，不会操作微信；
5. **完成**：控制台在线后回到「概览」启动 Agent、开关回复。

**已经用插件设置连过虚拟机时不会再让你连一遍。** 只要插件设置里的 `remote_ssh` / `remote_url` 已经连上（页面顶部能看到 `隧道 · 运行中 · ssh://...`），「部署」页第 1 步就直接显示「已连接（来自插件设置）」，第 2～4 步也只提示“部署页还没接管”，不会再出现连接表单。要在这里做检测、部署或更新时，点第 1 步的「用部署页接管」：插件会按当前连接预填地址、用户名和控制台端口，默认用本机 SSH 密钥（`~/.ssh/id_ed25519`）认证，确认后点「一键连接」即可，不需要重新输密码；「断开」后连接会交还给插件设置。WSL 镜像网络下如果本机端口已被其它隧道占用，插件会复用已有的 SSH 隧道并在页面标注。

首次部署写入的 `.env` 默认 `WECHAT_ALLOW_SEND=false`（只读、不自动回复），需要在设置里确认群、模型等配置后再手动打开发送；模型 Key 可以在部署选项里预先填，也可以之后在「设置」子页改。

部署选项（折叠区）包含 pip 镜像、sudo 密码、微信安装包路径（`.deb`，可选）和首次部署的 `.env` 字段。sudo 密码默认复用 SSH 密码；插件只在部署任务内通过 stdin 传给 `sudo -S`，不写入虚拟机文件、不出现在进程参数里，任务结束即失效。虚拟机上的控制台仍然只监听 `127.0.0.1`，由插件的 SSH 隧道转发到主机同端口。

内置源码包的维护：`assets/wechat-agent-linux-src.tar.gz` 由 `build/pack-source.mjs` 从 [wechat-agent-linux](https://github.com/lingmao233/wechat-agent-linux) 源码目录生成，排除 `.git`、`.venv`、`node_modules`、`tests`、`docs`、`.env`、数据库等。重新生成时，把源码仓库放在本插件目录的上一级，然后：

```powershell
cd dsh-plugin-wechat-agent
npm run build:source
```

生成后 `assets/BUNDLE.json` 记录文件数、大小、sha256 与构建时间，部署页会展示这些信息。

## 概览页能做什么

概览每 5 秒自动刷新 `/wechat/api/status`，连接信息来自 `/wechat/health`（每 10 秒）。

| 操作 | 实际请求 | 说明 |
|---|---|---|
| 启动 | `POST /wechat/api/start` | 拉起虚拟机的自动回复线程；已运行时不重复启动 |
| 停止 | `POST /wechat/api/stop` | 两步确认：第一次点变成「确认停止」，再点一次才执行，避免误触 |
| 清除停机标记 | `POST /wechat/api/clear-stop` | 删除 STOP 文件；若线程已退出会顺带重启（控制台返回 `restarted`） |
| 刷新 | `GET /wechat/api/status` + `/wechat/health` | 手动拉取并更新连接延迟 |
| 打开完整控制台 | 链接 `http://127.0.0.1:8765` | 隧道模式下从主机浏览器直达虚拟机控制台；直连模式用配置的地址 |

页面同时展示：运行阶段、线程是否存活、已运行时长、最近错误、停机文件是否存在；发出回复 / 私聊 / 主动接话 / 表情图片 / 语音回复 / 人设过滤六个开关；回复群与私聊白名单；消息统计与处理队列；SSH 隧道目标、延迟与重连次数。

## 日志页

- **事件**：`GET /wechat/api/events`，按 INFO / WARN / ERROR 过滤，4 秒自动刷新（可关）；
- **回复**：`GET /wechat/api/replies`，展示群、成员、状态、原因、原消息与回复正文；
- **发送审计**：`GET /wechat/api/audit`，展示是否放行、拒绝原因与目标成员。

三类数据都只读，来自虚拟机，不在主机侧落库。

## 平台页（三号互联）

「平台」子页把小红书 / 抖音接进同一个微信 Agent：

- **账号状态**：分别显示抖音、小红书是否已登录、浏览器模式、账号 ID 和有效 @ 白名单；「打开浏览器」在虚拟机里打开可见浏览器，第一次用需要扫码登录，二维码区域就在虚拟机桌面；「关闭」立即释放浏览器；
- **账号关联（三号互联）**：选择平台、填平台稳定用户 ID（不是昵称）、平台显示名，选一个微信成员后绑定。绑定后该平台 ID 自动进入 @ 白名单，解绑即移除；页面下方有「刷新」按钮；
- **浏览与评论**：选平台和关键词浏览公开内容 → 读评论 → 写评论。写评论会带出已关联成员的 @ 多选，默认勾选 dry-run；「生成评论计划」只进动作台账，不发送；
- **动作台账**：展示平台、目标、文本、状态、dry-run 和时间；只有 queued 且非 dry-run 的记录能点「确认执行」，会先弹二次确认；
- **平台记忆（三号共享）**：按成员和平台展示浏览、读评论、计划/已发评论/@ 的记忆，回复模型会读取这些记忆；
- **主动浏览**：显示开关、间隔、关键词、静默时段、上次运行与最近结果；「立即跑一轮」手动触发（默认只生成 dry-run 计划，开关在「设置 → 平台」）。

页面顶部固定说明三号互联的边界：所有平台写操作默认 dry-run；真实发送需要「允许平台评论」开关 + 动作台账二次确认；遇到验证码、登录失效或安全验证就停下。真实 @ 使用平台原生候选选择，@ 授权只认稳定平台用户 ID，显示名只做候选提示。

## 设置页

- 读取 `GET /wechat/api/config`（字段、当前值、`configured_secrets`），按「常用 / 高级」分组渲染 216 项中的非隐藏项；**「模型」组固定排在最前面**，文字模型地址 / 文字模型 Key / 文字模型都在常用首屏，不用往下翻；「平台」组包含浏览器开关、写开关、动作频率、意图触发、自动评论、共享记忆、主动浏览与静默时段；
- 回复群、私聊白名单用按钮式多选：群列表来自 `GET /wechat/api/groups` 的 `@chatroom` 群，私聊联系人来自 `GET /wechat/api/wechat/private-chats`，也可以直接粘贴逗号分隔的 wxid；
- 密钥类字段只显示「已配置 / 未配置」，留空提交表示保持原值，勾选「清除」才会清空；修改项会实时计数；
- **「人设文件上传」卡片支持直接拖拽文件或整个文件夹**（也可以点「选择文件 / 选择文件夹」）：文件夹会保留 `references/` 等子目录；只收文本扩展名（`.md/.markdown/.txt/.json/.yaml/.yml/.toml/.ini/.csv`），单次最多 200 个文件、合计 5 MB；填好人设目录名后上传到虚拟机 `personas/<name>/`，可勾选「覆盖同名文件」和「上传后设为当前人设」（写 `PERSONA_NAME` / `PERSONA_FILE` 并按需重载）；主文件优先 `SKILL.md`，其次顶层第一个 `.md`；成功后会刷新「虚拟机上的 N 个人设」列表；
- 保存是两步确认：写入 `POST /wechat/api/config`（`{ values, clear_secrets }`），落盘到虚拟机 `.env`，Agent 正在运行时按新配置重启监听；成功后提示「已保存，监听已按新配置重启」。「重置」丢弃所有未保存改动并重新拉取。

本页只读写 Python 侧 `CONFIG_SCHEMA`，插件自己的 9 个连接参数仍在 DSH 插件设置里。

## 配置

DSH 设置页按 Cordis Schema 渲染以下键。除 `remote_ssh` 和 `remote_url` 外，其余键名与 `src/wechat_agent/config.py` 完全一致。

| 键 | 默认 | 说明 |
|---|---|---|
| `remote_ssh` | 空 | 虚拟机 SSH 目标，例如 `wx@192.168.1.50`。填写后插件自己维持 `ssh -L` 隧道，控制台端口无需在虚拟机上对外监听 |
| `remote_url` | 空 | 直连控制台地址，例如 `http://192.168.1.50:8765`；与 `remote_ssh` 同时填写时只取它的端口作为隧道两端端口 |
| `python` | 空 | 解释器；留空优先使用项目 `.venv`，否则使用系统 Python。仅本地模式 |
| `project_dir` | 空 | 仓库根目录；本地安装时默认取插件包上一级。仅本地模式 |
| `config_file` | 空 | 传给 CLI 的 `.env` 路径。仅本地模式 |
| `desktop_host` | `127.0.0.1` | 本地控制台监听地址。仅本地模式 |
| `desktop_port` | `8765` | 本地控制台监听端口。仅本地模式 |
| `desktop_token` | 空 | 访问令牌；本地模式留空沿用控制台 `.env`，远程/隧道模式留空表示远端未设令牌 |
| `wechat_group_names` | `[]` | 回复群列表；留空沿用控制台 `.env`。仅本地模式 |

SSH 隧道与远程模式下，令牌只从 `desktop_token` 读取：虚拟机 `.env` 与本机 `.env` 不是同一份文件，插件不会把本机的 `DESKTOP_TOKEN` 发给远端。远端 `DESKTOP_TOKEN` 为空时保持留空即可，目前虚拟机的控制台就是这样配置的。

在「部署」子页连接过虚拟机后，连接参数以 `~/.dsh/wechat-agent-setup.json` 为准，`remote_ssh` / `remote_url` 被忽略（避免两份配置打架）。部署页生成的虚拟机 `.env` 把 `DESKTOP_TOKEN` 留空，并让控制台只监听 `127.0.0.1`；通过 SSH 隧道访问不需要令牌。如果要给控制台设令牌，目前需要在虚拟机 `.env` 里改，再在部署页重新连接时把令牌填进连接记录（该字段暂未在页面暴露）。

SSH 使用系统 `ssh` 命令和默认密钥（`-o BatchMode=yes`，不会弹密码提示），插件运行期间自动重连；如果本机端口已经有别的隧道（例如手动跑了 `scripts/vm-tunnel.ps1`），插件会直接复用，不重复开一份。只开浏览器看控制台、不想启动 DSH 时，用那个脚本维持隧道即可。

## 输入框上方的「回声」摘要

面板注册在 `conversation.input.dock`，也就是聊天输入框正上方的一行（新会话首页同样在输入框上方），默认收起。收起时这一行显示「回声 18 位成员 · 3 个群 · 隧道 · 运行中 … 展开」，点整行展开；展开后内容超出高度时列表自己滚动，不会顶掉输入框。状态来自 `GET /wechat/health`，不额外占用控制台接口。隧道未就绪或连不上时摘要变为「隧道未连接」，展开后顶部给出原因（含 ssh 退出码）。展开后可切换：

- 「成员画像」：读取 `GET /wechat/api/members`，按群展示好感度，支持按昵称、成员 ID 或群名搜索；
- 「群像」：读取 `GET /wechat/api/groups`，展示群氛围、兴趣、群梗和画像版本；接口里同时有私聊和公众号，面板只保留 `@chatroom` 群，所以群数与控制台「回声」页一致。

面板具有加载、空数据和失败状态，读取失败可重试；远端不可达时面板顶部直接显示原因。渲染异常由错误边界隔离，不会带崩聊天界面。展开区底部提示完整控制台的位置。要点完整的成员/群像信息，用页面的「回声」子页。

## 代理路由

| DSH 同源路由 | 上游 | 方法 |
|---|---|---|
| `/wechat/api/*` | 隧道或直连的 `<console>/api/*`，或本地 `http://<desktop_host>:<desktop_port>/api/*` | `GET`、`POST` |
| `/wechat/health` | 插件自己生成，探测上游 `/api/status` | `GET` |
| `/wechat/setup/state` | 部署页状态：连接、检测结果、任务、隧道、内置源码包信息 | `GET` |
| `/wechat/setup/connect` | 测试 SSH、保存连接、启动 `ssh2` 隧道 | `POST` |
| `/wechat/setup/disconnect` | 删除保存的连接并停止隧道 | `POST` |
| `/wechat/setup/probe` | 只读环境检测 | `POST` |
| `/wechat/setup/run` | 部署 / 更新 / 阶段（agent、key、check、autostart）/ 启动控制台 / 启动微信 / 启动 Agent，异步任务，日志通过 `/state` 轮询 | `POST` |
| `/wechat/setup/screenshot` | 虚拟机桌面截图（PNG data URL），给扫码登录用 | `POST` |

代理自动附带令牌，浏览器不直接接触控制台地址和令牌。具体 API 路径由 `desktop.py` 决定，插件不维护第二套路由表。部署接口只接受 JSON，POST body 上限 1 MB，与 DSH webServer 的其他接口一致；唯一例外是 `/wechat/api/personas/upload`（人设文件/文件夹上传），上限放宽到 **12 MB**，与控制台侧 5 MB 文本上限留足 JSON/UTF-8 开销。

`/wechat/health` 永远返回 200，即使虚拟机没开，因此可以直接给主机侧做状态展示或探活：

```json
{
  "mode": "remote",
  "transport": "ssh",
  "target": "ssh://wx@192.168.1.50 → 127.0.0.1:8765",
  "reachable": true,
  "http_status": 200,
  "latency_ms": 41,
  "console": { "phase": "running", "thread_alive": true, "group_name": "…", "last_error": null },
  "tunnel": { "target": "wx@192.168.1.50", "port": 8765, "mode": "running", "external": false, "restarts": 0, "error": "" },
  "error": ""
}
```

`remote_url` 写错时插件不会悄悄退回本地模式：代理返回 502 `wechat_console_unavailable`，health 的 `error` 说明是地址非法还是连不上。

## 安全与隐私

- SSH 连接信息保存在本机 `~/.dsh/wechat-agent-setup.json`（0600），`断开` 时删除；插件不上传这些信息；
- 虚拟机密码、模型 Key 只应存在于本机或虚拟机 `.env`，**不要提交到 Git**；仓库已忽略 `.env`、`node_modules`、`artifacts`、`state` 等目录；
- 微信登录和自动回复有账号风险，只使用专用测试号；不要在公开 issue 里贴二维码、Cookie、token 或密码；
- 安全漏洞请按 [SECURITY.md](SECURITY.md) 私下报告。

## 贡献

欢迎 issue 和 PR；提交前请运行 `npm run check`，并阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

MIT，见 [LICENSE](LICENSE)。内置的 Linux Agent 源码包（`assets/wechat-agent-linux-src.tar.gz`）随插件一起分发，同样以 MIT 提供；其中的 `personas/dafeiyu` 保留自带的 MIT LICENSE。
