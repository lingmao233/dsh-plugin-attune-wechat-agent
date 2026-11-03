window.__ModuleLoader__.load({
	id: "dsh-plugin-wechat-agent",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");

		const API_BASE = "/wechat/api";
		const HEALTH_URL = "/wechat/health";
		const SETUP_BASE = "/wechat/setup";
		const SETUP_STATE_URL = `${SETUP_BASE}/state`;
		const VIEW_SLOT = "conversation.view";
		const SETTINGS_SLOT = "settings.section";
		const TABS = [
			{ id: "overview", label: "概览" },
			{ id: "echo", label: "回声" },
			{ id: "platform", label: "平台" },
			{ id: "settings", label: "设置" },
			{ id: "deploy", label: "部署" },
			{ id: "logs", label: "日志" },
		];
		const ACTION_LABELS = { start: "启动", stop: "停止", "clear-stop": "清除停机标记" };
		const PHASE_LABELS = { running: "运行中", starting: "启动中", stopped: "已停止", error: "异常" };
		const LEVEL_TONES = { ERROR: "error", WARN: "warn", WARNING: "warn", INFO: "ok", DEBUG: "muted" };
		const STATUS_TONES = {
			sent: "ok",
			replied: "ok",
			skipped: "muted",
			failed: "error",
			pending: "warn",
			processing: "warn",
		};

		const C = {
			card: "var(--dsw-alias-bg-layer-1, rgba(127,127,127,0.06))",
			cardBorder: "var(--dsw-alias-border-l1, rgba(127,127,127,0.22))",
			divider: "var(--dsw-alias-border-l2, rgba(127,127,127,0.16))",
			text: "var(--dsw-alias-label-primary, inherit)",
			secondary: "var(--dsw-alias-label-secondary, #666)",
			muted: "var(--dsw-alias-label-tertiary, #888)",
			brand: "var(--dsw-alias-brand-primary, #4d6bfe)",
			brandSoft: "var(--dsw-alias-brand-bg, rgba(77,107,254,0.09))",
			hover: "var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,0.10))",
			error: "var(--dsw-alias-label-error, #d4380d)",
			ok: "#16a34a",
			warn: "#c27c0e",
		};
		const styles = {
			// Echo list and detail atoms.
			card: { flexShrink: 0, width: "100%", boxSizing: "border-box", minWidth: 0, border: `1px solid ${C.cardBorder}`, borderRadius: 12, background: C.card, color: C.text, fontSize: 12, lineHeight: 1.5, overflow: "hidden" },
			head: { display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 11px", border: 0, background: "transparent", color: "inherit", font: "inherit", textAlign: "left", cursor: "pointer" },
			title: { fontWeight: 650, flex: "none" },
			summary: { color: C.muted, fontSize: 11, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
			toggle: { color: C.secondary, fontSize: 11, flex: "none" },
			body: { borderTop: `1px solid ${C.divider}`, padding: "9px 10px 10px", maxHeight: 340, overflowY: "auto" },
			toolbar: { display: "flex", alignItems: "center", gap: 6, marginBottom: 8 },
			tabs: { display: "inline-flex", gap: 2, padding: 2, borderRadius: 7, background: C.hover },
			tab: { border: 0, borderRadius: 5, background: "transparent", color: C.secondary, padding: "3px 10px", font: "inherit", fontSize: 11, cursor: "pointer" },
			activeTab: { background: C.card, color: C.brand, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
			spacer: { flex: 1 },
			refresh: { border: `1px solid ${C.cardBorder}`, borderRadius: 6, background: "transparent", color: C.secondary, font: "inherit", fontSize: 10, padding: "3px 8px", cursor: "pointer" },
			search: { width: "100%", boxSizing: "border-box", marginBottom: 8, border: `1px solid ${C.cardBorder}`, borderRadius: 7, background: "transparent", color: C.text, font: "inherit", fontSize: 11, padding: "5px 8px", outline: "none" },
			hint: { color: C.muted, padding: "8px 2px" },
			errorText: { color: C.error, padding: "2px 0 6px", wordBreak: "break-word" },
			groupTitle: { display: "flex", gap: 7, alignItems: "baseline", margin: "8px 0 4px", fontWeight: 600 },
			groupMeta: { color: C.muted, fontSize: 10, fontWeight: 400 },
			row: { display: "flex", alignItems: "center", gap: 8, minHeight: 25, padding: "2px 1px" },
			rowButton: { display: "flex", alignItems: "center", gap: 8, width: "100%", minHeight: 30, padding: "3px 5px", border: 0, borderRadius: 7, background: "transparent", color: "inherit", font: "inherit", textAlign: "left", cursor: "pointer" },
			rowButtonActive: { background: C.hover },
			rowHint: { color: C.muted, fontSize: 10, flex: "none" },
			linkButton: { border: 0, background: "transparent", color: C.brand, font: "inherit", fontSize: 11, cursor: "pointer", padding: "2px 0", flex: "none" },
			rowName: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
			meter: { width: 76, height: 6, borderRadius: 999, background: C.hover, overflow: "hidden", flex: "none" },
			meterFill: { height: "100%", borderRadius: 999, background: C.brand },
			value: { width: 34, textAlign: "right", fontVariantNumeric: "tabular-nums", flex: "none" },
			badge: { display: "inline-block", padding: "1px 6px", borderRadius: 999, background: C.hover, color: C.secondary, fontSize: 10, marginRight: 4 },
			detailHead: { display: "flex", flexDirection: "column", gap: 1, paddingBottom: 10, borderBottom: `1px solid ${C.divider}` },
			detailBackRow: { display: "flex", alignItems: "center", marginBottom: 6 },
			detailBack: { border: 0, background: "transparent", color: C.brand, font: "inherit", fontSize: 11, lineHeight: 1.4, cursor: "pointer", padding: "1px 0", alignSelf: "flex-start" },
			detailEyebrow: { color: C.muted, fontSize: 10.5, letterSpacing: "0.02em" },
			detailTitle: { fontWeight: 650, fontSize: 15, lineHeight: 1.35, wordBreak: "break-word" },
			detailMeta: { color: C.muted, fontSize: 11.5, lineHeight: 1.5, wordBreak: "break-word" },
			detailSection: { padding: "8px 0", borderBottom: `1px solid ${C.divider}` },
			detailLabel: { color: C.secondary, fontWeight: 650, marginBottom: 4 },
			detailItem: { color: C.secondary, padding: "1px 0", wordBreak: "break-word" },

			// Full page.
			page: { boxSizing: "border-box", width: "100%", maxWidth: 1120, margin: "0 auto", padding: "20px 24px 44px", display: "flex", flexDirection: "column", gap: 14, color: C.text, fontSize: 12.5, lineHeight: 1.55 },
			pageHead: { display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" },
			h1: { margin: 0, fontSize: 17, fontWeight: 700 },
			sub: { color: C.muted, fontSize: 11.5, marginTop: 3 },
			headActions: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
			nav: { display: "inline-flex", gap: 3, padding: 3, borderRadius: 9, background: C.hover, alignSelf: "flex-start" },
			navTab: { border: 0, borderRadius: 7, background: "transparent", color: C.secondary, padding: "5px 15px", font: "inherit", fontSize: 12.5, cursor: "pointer" },
			navTabActive: { background: C.card, color: C.brand, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
			section: { display: "flex", flexDirection: "column", gap: 12 },
			card2: { border: `1px solid ${C.cardBorder}`, borderRadius: 12, background: C.card, padding: "12px 14px" },
			cardHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 9, flexWrap: "wrap" },
			cardTitle: { fontSize: 12, fontWeight: 650, color: C.secondary, letterSpacing: "0.01em" },
			cardHint: { color: C.muted, fontSize: 11 },
			grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))", gap: 9 },
			gridWide: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 9 },
			stat: { border: `1px solid ${C.divider}`, borderRadius: 10, padding: "8px 11px", background: "transparent" },
			statLabel: { color: C.muted, fontSize: 10.5 },
			statValue: { fontSize: 16, fontWeight: 650, marginTop: 2, fontVariantNumeric: "tabular-nums" },
			switchList: { display: "flex", flexDirection: "column" },
			switchRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 34, padding: "5px 1px", borderBottom: `1px solid ${C.divider}` },
			switchLabel: { color: C.text, fontSize: 12.5 },
			switchState: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, flex: "none" },
			switchDot: { width: 7, height: 7, borderRadius: 999, flex: "none" },
			switchNumber: { width: 42, textAlign: "right", fontSize: 13, fontWeight: 650, fontVariantNumeric: "tabular-nums" },
			kvRow: { display: "flex", alignItems: "baseline", gap: 10, padding: "3px 0", flexWrap: "wrap" },
			kvLabel: { color: C.muted, fontSize: 11, minWidth: 76 },
			kvValue: { flex: 1, minWidth: 0, wordBreak: "break-word" },
			button: { border: `1px solid ${C.cardBorder}`, borderRadius: 7, background: "transparent", color: C.text, font: "inherit", fontSize: 11.5, padding: "4px 11px", cursor: "pointer" },
			buttonPrimary: { border: `1px solid ${C.brand}`, borderRadius: 7, background: C.brand, color: "#fff", font: "inherit", fontSize: 11.5, padding: "4px 11px", cursor: "pointer" },
			buttonDanger: { border: `1px solid ${C.error}`, borderRadius: 7, background: "transparent", color: C.error, font: "inherit", fontSize: 11.5, padding: "4px 11px", cursor: "pointer" },
			buttonDisabled: { opacity: 0.5, cursor: "default" },
			pill: { display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 999, padding: "1px 9px", fontSize: 10.5, background: C.hover, color: C.secondary },
			banner: { borderRadius: 10, padding: "8px 12px", fontSize: 11.5, whiteSpace: "pre-wrap", wordBreak: "break-word" },
			listRow: { display: "flex", alignItems: "baseline", gap: 9, padding: "6px 1px", borderTop: `1px solid ${C.divider}` },
			mono: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontVariantNumeric: "tabular-nums", color: C.muted, fontSize: 10.5, flex: "none" },
			truncate: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
			wrapText: { flex: 1, minWidth: 0, wordBreak: "break-word" },
			chips: { display: "flex", flexWrap: "wrap", gap: 6 },
			chip: { border: `1px solid ${C.cardBorder}`, borderRadius: 999, background: "transparent", color: C.secondary, padding: "2px 10px", font: "inherit", fontSize: 11, cursor: "pointer" },
			chipActive: { borderColor: C.brand, color: C.brand, background: C.brandSoft },
			input: { width: "100%", boxSizing: "border-box", border: `1px solid ${C.cardBorder}`, borderRadius: 7, background: "transparent", color: C.text, font: "inherit", fontSize: 11.5, padding: "4px 8px", outline: "none" },
			fieldRow: { display: "flex", flexDirection: "column", gap: 4, padding: "8px 0", borderTop: `1px solid ${C.divider}` },
			fieldTop: { display: "flex", alignItems: "center", gap: 9 },
			fieldLabel: { flex: 1, minWidth: 0 },
			fieldTip: { color: C.muted, fontSize: 10.5, marginTop: 1 },
			groupCard: { border: `1px solid ${C.divider}`, borderRadius: 10, padding: "4px 12px 10px", marginBottom: 10 },
			groupHead: { fontWeight: 650, fontSize: 12, margin: "8px 0 2px" },
			link: { color: C.brand, textDecoration: "none" },
			dropzone: { border: `1px dashed ${C.cardBorder}`, borderRadius: 10, padding: "14px 12px", textAlign: "center", cursor: "pointer", color: C.secondary, fontSize: 11.5, background: "transparent" },
			dropzoneActive: { borderColor: C.brand, background: C.brandSoft, color: C.brand },
			fileList: { display: "flex", flexDirection: "column", gap: 2, marginTop: 8, maxHeight: 150, overflowY: "auto" },
			fileRow: { display: "flex", alignItems: "baseline", gap: 9, padding: "2px 1px", fontSize: 11, color: C.secondary },
		};

		// One-click VM setup (部署 tab): forms, checklist rows, job log.
		const wiz = {
			grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 },
			field: { display: "flex", flexDirection: "column", gap: 3, marginBottom: 8 },
			label: { fontSize: 11, color: C.secondary },
			input: { width: "100%", boxSizing: "border-box", border: `1px solid ${C.cardBorder}`, borderRadius: 7, background: "transparent", color: C.text, font: "inherit", fontSize: 12, padding: "6px 9px", outline: "none" },
			row: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 },
			stepIndex: { width: 20, height: 20, borderRadius: 999, background: C.brandSoft, color: C.brand, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flex: "none" },
			checkRow: { display: "flex", alignItems: "baseline", gap: 8, padding: "3px 0" },
			checkMark: { width: 14, flex: "none", textAlign: "center", fontWeight: 700 },
			log: { marginTop: 8, maxHeight: 240, overflow: "auto", background: "rgba(127,127,127,0.08)", border: `1px solid ${C.divider}`, borderRadius: 8, padding: "8px 10px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 10.5, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word", color: C.secondary },
			shot: { marginTop: 8, maxWidth: "100%", maxHeight: 320, borderRadius: 8, border: `1px solid ${C.cardBorder}`, display: "block" },
			stepActive: { borderColor: C.brand },
			stepDone: { borderColor: "rgba(22,163,74,0.55)" },
			hintSmall: { color: C.muted, fontSize: 10.5, marginTop: 4 },
			mono: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 10.5 },
		};

		// 「部署 → 连接虚拟机」的操作弹窗。所有连接输入都放在这个 DSH 风格
		// 的 dialog 里，页面本身只保留一个「一键连接」入口。
		const dialog = {
			overlay: { position: "fixed", inset: "var(--dsh-frame-chrome-top, 0px) 0 0", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", boxSizing: "border-box", background: "var(--dsw-alias-bg-mask-1, rgba(0,0,0,0.32))", backdropFilter: "var(--dsw-mask-blur, blur(4px))", WebkitBackdropFilter: "var(--dsw-mask-blur, blur(4px))" },
			panel: { width: "min(660px, 100%)", maxWidth: "calc(100vw - 48px)", maxHeight: "min(780px, calc(100vh - 48px))", minWidth: 0, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", outline: "none", borderRadius: "var(--dsw-radius-panel, 16px)", background: "var(--dsw-alias-bg-layer-2, #fff)", color: "var(--dsw-alias-label-primary, inherit)", boxShadow: "var(--dsw-elevation-prominent, var(--dsw-elevation-panel, 0 18px 48px rgba(0,0,0,0.22)))", fontSize: 12.5, lineHeight: 1.55 },
			header: { display: "flex", alignItems: "flex-start", gap: 12, padding: "16px 20px 13px", borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.16))", flexShrink: 0 },
			title: { fontSize: 15, fontWeight: 650, color: "var(--dsw-alias-label-primary, inherit)" },
			subtitle: { marginTop: 2, color: "var(--dsw-alias-label-tertiary, #888)", fontSize: 11.5 },
			close: { marginLeft: "auto", width: 28, height: 28, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", border: 0, borderRadius: "var(--dsw-radius-md, 8px)", background: "transparent", color: "var(--dsw-alias-label-secondary, #666)", font: "inherit", fontSize: 16, lineHeight: 1, cursor: "pointer" },
			body: { padding: "16px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, minHeight: 0 },
			footer: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.16))", background: "var(--dsw-alias-bg-layer-1, rgba(127,127,127,0.04))", flexWrap: "wrap", flexShrink: 0 },
			button: { border: "1px solid var(--dsw-alias-border-l1, rgba(127,127,127,0.22))", borderRadius: "var(--dsw-radius-md, 8px)", background: "transparent", color: "var(--dsw-alias-label-primary, inherit)", font: "inherit", fontSize: 12.5, padding: "6px 14px", cursor: "pointer" },
			buttonPrimary: { border: "1px solid var(--dsw-alias-button-primary-fill, var(--dsw-alias-brand-primary, #4d6bfe))", borderRadius: "var(--dsw-radius-md, 8px)", background: "var(--dsw-alias-button-primary-fill, var(--dsw-alias-brand-primary, #4d6bfe))", color: "var(--dsw-alias-label-primary-foreground, #fff)", font: "inherit", fontSize: 12.5, fontWeight: 600, padding: "6px 16px", cursor: "pointer" },
			buttonDisabled: { opacity: 0.55, cursor: "default" },
			step: { display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", border: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.16))", borderRadius: "var(--dsw-radius-lg, 12px)", background: "var(--dsw-alias-bg-layer-1, rgba(127,127,127,0.04))" },
			stepHead: { display: "flex", alignItems: "center", gap: 8 },
			stepTitle: { fontSize: 12.5, fontWeight: 650 },
			note: { color: "var(--dsw-alias-label-tertiary, #888)", fontSize: 10.5, lineHeight: 1.6 },
			actions: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
			details: { marginTop: 2, padding: "9px 11px", border: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.16))", borderRadius: "var(--dsw-radius-md, 8px)", background: "var(--dsw-alias-bg-layer-1, rgba(127,127,127,0.04))" },
			detailsSummary: { cursor: "pointer", color: "var(--dsw-alias-link, #3d5af1)", fontSize: 11, fontWeight: 600, lineHeight: 1.5 },
			detailsBody: { display: "flex", flexDirection: "column", gap: 9, marginTop: 9 },
			guideItem: { minWidth: 0 },
			guideItemTitle: { color: "var(--dsw-alias-label-primary, inherit)", fontSize: 11.5, fontWeight: 650, lineHeight: 1.55 },
			guideText: { marginTop: 3, color: "var(--dsw-alias-label-secondary, #555)", fontSize: 10.5, lineHeight: 1.7, whiteSpace: "pre-wrap" },
			externalLink: { color: "var(--dsw-alias-link, #3d5af1)", textDecoration: "underline", wordBreak: "break-all" },
			command: { margin: 0, padding: "8px 10px", borderRadius: "var(--dsw-radius-md, 8px)", border: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,0.16))", background: "var(--dsw-alias-markdown-code-block, rgba(127,127,127,0.08))", color: "var(--dsw-alias-label-secondary, #666)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 10.5, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 112, overflow: "auto" },
			input: { padding: "7px 10px", fontSize: 12.5, borderRadius: "var(--dsw-radius-md, 8px)" },
			linkRow: { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" },
			link: { color: "var(--dsw-alias-link, var(--dsw-alias-brand-primary, #4d6bfe))", fontSize: 11, cursor: "pointer", textDecoration: "none" },
			code: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", background: "var(--dsw-alias-markdown-inline-code, rgba(127,127,127,0.10))", borderRadius: 4, padding: "1px 5px", fontSize: 10.5 },
		};

		// ---------------------------------------------------------------- helpers

		function errorText(error) {
			const message = error && error.message ? error.message : String(error);
			return message.replace(/^Error:\s*/, "");
		}

		function fmtTime(iso) {
			if (!iso) return "";
			const date = new Date(iso);
			if (Number.isNaN(date.getTime())) return String(iso);
			const pad = (value) => String(value).padStart(2, "0");
			return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
		}

		function fmtDuration(iso) {
			if (!iso) return "—";
			const started = new Date(iso).getTime();
			if (!Number.isFinite(started)) return "—";
			const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
			const hours = Math.floor(seconds / 3600);
			const minutes = Math.floor((seconds % 3600) / 60);
			if (hours > 0) return `${hours} 小时 ${minutes} 分`;
			if (minutes > 0) return `${minutes} 分 ${seconds % 60} 秒`;
			return `${seconds} 秒`;
		}

		function splitList(text) {
			return String(text ?? "")
				.split(/[,，]/)
				.map((item) => item.trim())
				.filter(Boolean);
		}

		// 小白一键连接：在虚拟机桌面打开终端，粘贴这一行执行。SSH 已在运行就
		// 直接打印连接码（这时不用输任何密码）；没装才用 sudo 安装并启动 SSH、
		// 允许密码登录（默认 22 端口），最后同样打印一行连接码。用户只需要把
		// 连接码粘回网页并输入开机密码，不需要自己查 IP、用户名或装 SSH。
		const ONBOARD_COMMAND = `if systemctl is-active --quiet ssh; then echo "WECHAT-VM-CODE:$(whoami)@$(hostname -I | awk '{print $1}'):22"; else sudo apt-get update -qq || true; sudo apt-get install -y -qq openssh-server && sudo systemctl enable --now ssh; sudo sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config; sudo systemctl restart ssh; command -v ufw >/dev/null && sudo ufw allow 22/tcp >/dev/null 2>&1 || true; echo "WECHAT-VM-CODE:$(whoami)@$(hostname -I | awk '{print $1}'):22"; fi`;
// 用户提供的 VMware Workstation 安装包分享链接（夸克网盘）。
const VMWARE_SHARE_URL = "https://pan.quark.cn/s/3f0e0687094d";
const VMWARE_INSTALLER_NAME = "VMware-workstation-17.6.1-24319023.exe";

		function parseOnboardCode(text) {
			const raw = String(text || "");
			const match = raw.match(/WECHAT-VM-CODE:\s*([^@\s]+)@([^\s:]+):(\d+)/i)
				|| raw.trim().match(/^([^@\s]+)@([^\s:]+):(\d+)$/);
			if (!match) return null;
			return { username: match[1], host: match[2], port: match[3] };
		}

		async function copyTextToClipboard(text) {
			try {
				if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
					await navigator.clipboard.writeText(text);
					return true;
				}
			} catch {
				// 某些 DSH/Electron 环境禁用 clipboard API，继续走 execCommand。
			}
			try {
				const area = document.createElement("textarea");
				area.value = text;
				area.style.position = "fixed";
				area.style.opacity = "0";
				document.body.appendChild(area);
				area.select();
				const copied = document.execCommand("copy");
				document.body.removeChild(area);
				return copied;
			} catch {
				return false;
			}
		}

		function numberOrText(value) {
			if (value === "" || value === null || value === undefined) return "";
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : value;
		}

		function phaseLabel(phase) {
			return PHASE_LABELS[phase] || phase || "未知";
		}

		function healthLabel(health) {
			if (!health || health.status !== "ready" || !health.data) return "";
			const data = health.data;
			const mode = data.mode === "remote" ? (data.transport === "ssh" ? "隧道" : "远端") : "本机";
			if (!data.reachable) {
				// 刚接管连接时隧道要从 starting 走到 running，这一两秒不是故障。
				if (data.tunnel && data.tunnel.mode === "starting") return `${mode} · 连接中`;
				return data.mode === "remote" ? (data.transport === "ssh" ? "隧道未连接" : "远端未连接") : "本机未运行";
			}
			const phase = data.console && data.console.phase;
			return `${mode} · ${phase ? phaseLabel(phase) : "已连接"}`;
		}

		function healthStarting(health) {
			return Boolean(health && health.status === "ready" && health.data && health.data.reachable === false
				&& health.data.tunnel && health.data.tunnel.mode === "starting");
		}

		function healthDetail(health) {
			if (!health || health.status !== "ready" || !health.data) return "";
			const data = health.data;
			if (data.reachable) return "";
			const reason = data.error || "控制台不可达";
			if (data.tunnel && data.tunnel.mode && data.tunnel.mode !== "running" && data.tunnel.mode !== "external") {
				return `${reason}（SSH 隧道：${data.tunnel.mode}${data.tunnel.error ? `，${data.tunnel.error}` : ""}）`;
			}
			return reason;
		}

		function consoleUrl(health) {
			if (!health || health.status !== "ready" || !health.data) return "";
			const data = health.data;
			if (data.mode === "remote" && data.transport === "ssh" && data.tunnel && data.tunnel.port) return `http://127.0.0.1:${data.tunnel.port}`;
			if (data.mode === "remote" && typeof data.target === "string" && /^https?:\/\//.test(data.target)) return data.target;
			return "";
		}

		async function fetchJson(url, init) {
			const response = await fetch(url, init);
			const text = await response.text();
			let payload = null;
			if (text) {
				try {
					payload = JSON.parse(text);
				} catch {
					throw new Error(`HTTP ${response.status}：响应不是 JSON`);
				}
			}
			if (!response.ok) {
				const detail = payload && (payload.error || payload.message || payload.detail);
				throw new Error(detail ? `${detail}（HTTP ${response.status}）` : `HTTP ${response.status}`);
			}
			return payload;
		}

		function getJson(url) {
			return fetchJson(url, { headers: { Accept: "application/json" } });
		}

		function postJson(url, payload) {
			return fetchJson(url, {
				method: "POST",
				headers: { Accept: "application/json", "Content-Type": "application/json" },
				body: JSON.stringify(payload || {}),
			});
		}

		/**
		 * One-shot JSON read for the dock panel: `[state, reload]`, two hooks.
		 */
		function useJson(url) {
			const [state, setState] = React.useState({ status: "loading", data: null, error: "" });
			const [token, setToken] = React.useState(0);
			React.useEffect(() => {
				let alive = true;
				getJson(url)
					.then((data) => {
						if (alive) setState({ status: "ready", data, error: "" });
					})
					.catch((error) => {
						if (alive) setState({ status: "error", data: null, error: errorText(error) });
					});
				return () => {
					alive = false;
				};
			}, [url, token]);
			return [state, () => setToken((value) => value + 1)];
		}

		function useEndpoint(path) {
			return useJson(API_BASE + path);
		}

		/**
		 * Polled JSON resource for the full page: keeps the last good payload while
		 * a refresh fails, so a slow tunnel never blanks the dashboard.
		 * `intervalMs` 0 disables polling.
		 */
		function useResource(url, intervalMs) {
			const [state, setState] = React.useState({ status: "loading", data: null, error: "", updatedAt: 0 });
			const [token, setToken] = React.useState(0);
			React.useEffect(() => {
				let alive = true;
				getJson(url)
					.then((data) => {
						if (alive) setState({ status: "ready", data, error: "", updatedAt: Date.now() });
					})
					.catch((error) => {
						if (alive) setState((prev) => ({ status: prev.status === "ready" ? "ready" : "error", data: prev.data, error: errorText(error), updatedAt: prev.updatedAt }));
					});
				return () => {
					alive = false;
				};
			}, [url, token]);
			React.useEffect(() => {
				if (!intervalMs) return undefined;
				const timer = setInterval(() => setToken((value) => value + 1), intervalMs);
				return () => clearInterval(timer);
			}, [intervalMs]);
			return [state, () => setToken((value) => value + 1)];
		}

		// ------------------------------------------------------------- dock pieces

		function itemTexts(value, limit) {
			if (!Array.isArray(value)) return [];
			return value.map((item) => (typeof item === "string" ? item : item && (item.text || item.summary || item.name))).filter(Boolean).slice(0, limit);
		}

		function memberLabel(member) {
			return String(member.member_name || member.nickname || member.display_name || member.stable_id || member.member_id || "未知成员");
		}

		function memberKey(member) {
			return `${member.account_id || ""}|${member.group_id || ""}|${member.member_id || member.stable_id || ""}`;
		}

		function groupKey(group) {
			return `${group.account_id || ""}|${group.group_id || ""}`;
		}

		function MembersList({ members, query, onSelect, selectedKey }) {
			const needle = query.trim().toLowerCase();
			const filtered = needle === "" ? members : members.filter((member) => [member.member_name, member.nickname, member.display_name, member.member_id, member.stable_id, member.group_name].some((value) => String(value || "").toLowerCase().includes(needle)));
			if (filtered.length === 0) return React.createElement("div", { style: styles.hint }, "没有匹配的成员");
			const buckets = [];
			for (const member of filtered) {
				const key = String(member.group_name || member.group_id || "未分组");
				let bucket = buckets.find((item) => item.key === key);
				if (!bucket) {
					bucket = { key, rows: [] };
					buckets.push(bucket);
				}
				bucket.rows.push(member);
			}
			return React.createElement("div", null, buckets.map((bucket) =>
				React.createElement("div", { key: bucket.key },
					React.createElement("div", { style: styles.groupTitle }, bucket.key, React.createElement("span", { style: styles.groupMeta }, `${bucket.rows.length} 位`)),
					bucket.rows.map((member, index) => {
						const affinity = Number(member.affinity);
						const width = Number.isFinite(affinity) ? Math.max(2, Math.min(100, affinity)) : 2;
						const key = memberKey(member);
						return React.createElement("button", {
							key: `${key}:${index}`,
							type: "button",
							style: { ...styles.rowButton, ...(selectedKey === key ? styles.rowButtonActive : {}) },
							onClick: () => onSelect && onSelect(member),
							title: "查看成员详情",
							"aria-label": `查看 ${memberLabel(member)} 的详情`,
						},
							React.createElement("span", { style: styles.rowName }, memberLabel(member)),
							React.createElement("span", { style: styles.badge }, String(member.mode || member.relationship_mode || "平常")),
							React.createElement("span", { style: styles.meter }, React.createElement("span", { style: { ...styles.meterFill, width: `${width}%` } })),
							React.createElement("span", { style: styles.value }, Number.isFinite(affinity) ? affinity.toFixed(0) : "—"),
							onSelect ? React.createElement("span", { style: styles.rowHint }, "›") : null,
						);
					}),
				)));
		}

		function GroupsList({ groups, onSelect, selectedKey }) {
			if (groups.length === 0) return React.createElement("div", { style: styles.hint }, "还没有群画像");
			return React.createElement("div", null, groups.map((group, index) => {
				const atmosphere = itemTexts(group.atmosphere, 1);
				const interests = itemTexts(group.interests, 3);
				const memes = itemTexts(group.memes, 2);
				const key = groupKey(group);
				return React.createElement("section", { key: `${key}:${index}`, style: { ...styles.row, flexDirection: "column", alignItems: "stretch", gap: 2, padding: "8px 0", borderTop: `1px solid ${C.divider}`, ...(selectedKey === key ? styles.rowButtonActive : {}) } },
					React.createElement("div", { style: { ...styles.groupTitle, marginTop: 0, alignItems: "center" } },
						React.createElement("span", { style: { flex: 1, minWidth: 0 } }, String(group.group_name || "未命名群"), React.createElement("span", { style: styles.groupMeta }, ` ${Number(group.message_count) || 0} 条${group.semantic_version ? ` · 第 ${group.semantic_version} 版` : ""}`)),
						onSelect ? React.createElement("button", { type: "button", style: styles.linkButton, onClick: () => onSelect(group), "aria-label": `查看 ${String(group.group_name || "未命名群")} 的群像详情` }, "查看详情 ›") : null,
					),
					React.createElement("div", { style: { color: C.secondary } }, `氛围：${atmosphere[0] || "积累中"}`),
					React.createElement("div", { style: { color: C.secondary } }, "兴趣：", interests.length ? interests.map((text) => React.createElement("span", { key: text, style: styles.badge }, text)) : "积累中"),
					React.createElement("div", { style: { color: C.secondary } }, "群梗：", memes.length ? memes.map((text) => React.createElement("span", { key: text, style: styles.badge }, text)) : "积累中"),
				);
			}));
		}

		function ErrorState({ message, onRetry }) {
			return React.createElement("div", null,
				React.createElement("div", { style: styles.errorText }, `读取失败：${message}`),
				onRetry ? React.createElement("button", { type: "button", style: styles.refresh, onClick: onRetry }, "重试") : null,
			);
		}

		function DetailHeader({ eyebrow, title, subtitle, onBack }) {
			return React.createElement("div", null,
				React.createElement("div", { style: styles.detailBackRow },
					React.createElement("button", { type: "button", style: styles.detailBack, onClick: onBack }, "← 返回列表"),
				),
				React.createElement("div", { style: styles.detailHead },
					React.createElement("div", { style: styles.detailEyebrow }, eyebrow),
					React.createElement("div", { style: styles.detailTitle }, title),
					subtitle ? React.createElement("div", { style: styles.detailMeta }, subtitle) : null,
				),
			);
		}

		function DetailSection({ title, children }) {
			return React.createElement("div", { style: styles.detailSection },
				React.createElement("div", { style: styles.detailLabel }, title),
				React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 2 } }, children),
			);
		}

		function DetailItems({ items, empty }) {
			const list = Array.isArray(items) ? items.filter(Boolean) : [];
			if (list.length === 0) return React.createElement("div", { style: styles.detailItem }, empty || "积累中");
			return React.createElement("div", null, list.map((item, index) => React.createElement("div", { key: `${item}:${index}`, style: styles.detailItem }, `· ${item}`)));
		}

		function semanticItems(value, limit) {
			if (!Array.isArray(value)) return [];
			return value.slice(0, limit).map((item) => {
				if (typeof item === "string") return item;
				if (!item || typeof item !== "object") return "";
				const text = String(item.text || item.summary || item.name || "").trim();
				if (!text) return "";
				const confidence = Number(item.confidence_pct);
				return Number.isFinite(confidence) ? `${text} · ${confidence}%` : text;
			}).filter(Boolean);
		}

		function countedItems(value, limit) {
			if (!Array.isArray(value)) return [];
			return value.slice(0, limit).map((item) => {
				if (typeof item === "string") return item;
				if (!item || typeof item !== "object") return "";
				const name = String(item.name || item.text || item.summary || "").trim();
				const count = item.count === undefined || item.count === null || item.count === "" ? "" : ` (${item.count})`;
				return name ? `${name}${count}` : "";
			}).filter(Boolean);
		}

		function MemberDetail({ member, onBack }) {
			const fields = Array.isArray(member.profile_fields) ? member.profile_fields : [];
			const events = Array.isArray(member.recent_events) ? member.recent_events : [];
			const affinity = Number(member.affinity);
			const width = Number.isFinite(affinity) ? Math.max(2, Math.min(100, affinity)) : 2;
			return React.createElement("div", null,
				React.createElement(DetailHeader, {
					eyebrow: "成员画像 · 回声",
					title: memberLabel(member),
					subtitle: `${member.group_name || "未分组"} · ${member.member_id || "未知成员 ID"}`,
					onBack,
				}),
				React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "10px 0 2px" } },
					React.createElement(Pill, { tone: "brand" }, String(member.mode || "平常")),
					React.createElement("span", { style: styles.detailMeta }, "好感"),
					React.createElement("span", { style: styles.meter }, React.createElement("span", { style: { ...styles.meterFill, width: `${width}%` } })),
					React.createElement("span", { style: styles.value }, Number.isFinite(affinity) ? affinity.toFixed(0) : "—"),
				),
				React.createElement(DetailSection, { title: "成员画像" },
					fields.length > 0
						? fields.map((field, fieldIndex) => {
							const items = Array.isArray(field.items) ? field.items.map((item) => (typeof item === "string" ? item : item && (item.text || item.name) || "")) : [];
							return React.createElement("div", { key: `${field.key || field.label || fieldIndex}`, style: { marginTop: fieldIndex === 0 ? 0 : 7 } },
								React.createElement("div", { style: { color: C.text, fontWeight: 600, marginBottom: 2 } }, String(field.label || field.key || "画像")),
								React.createElement(DetailItems, { items }),
							);
						})
						: React.createElement("div", { style: styles.detailItem }, "这位成员还没有画像；先在群里多聊几次。")
				),
				React.createElement(DetailSection, { title: "最近事件" },
					React.createElement(DetailItems, {
						items: events.map((event) => {
							const at = event.at_text || "";
							const label = event.type_label || "事件";
							const content = event.content || event.evidence_excerpt || "";
							return [at, label, content].filter(Boolean).join(" · ");
						}),
						empty: "最近没有事件",
					})
				),
				member.url ? React.createElement("div", { style: { ...styles.detailMeta, marginTop: 8, wordBreak: "break-all" } }, `控制台：${member.url}`) : null,
			);
		}

		function GroupDetail({ group, onBack }) {
			const style = group.style && typeof group.style === "object" ? group.style : {};
			const ai = group.ai_style && typeof group.ai_style === "object" ? group.ai_style : {};
			const timeline = Array.isArray(group.timeline) ? group.timeline : [];
			const styleProfile = typeof style.profile === "string" ? style.profile.trim() : "";
			return React.createElement("div", null,
				React.createElement(DetailHeader, {
					eyebrow: "群像 · 回声",
					title: String(group.group_name || "未命名群"),
					subtitle: `${Number(group.message_count) || 0} 条消息${group.last_active_text ? ` · 最近活跃 ${group.last_active_text}` : ""} · ${group.semantic_version ? `画像第 ${group.semantic_version} 版` : "画像积累中"}`,
					onBack,
				}),
				React.createElement(DetailSection, { title: "群氛围" },
					React.createElement(DetailItems, { items: semanticItems(group.atmosphere, 12) })
				),
				React.createElement(DetailSection, { title: "兴趣" },
					React.createElement(DetailItems, { items: semanticItems(group.interests, 12) })
				),
				React.createElement(DetailSection, { title: "群梗" },
					React.createElement(DetailItems, { items: semanticItems(group.memes, 12) })
				),
				React.createElement(DetailSection, { title: "群风格" },
					styleProfile ? React.createElement("div", { style: { ...styles.detailItem, whiteSpace: "pre-wrap", color: C.text } }, styleProfile)
						: React.createElement("div", { style: styles.detailItem }, style.ready ? "风格画像为空" : "风格画像还在积累（需要更多消息）")
				),
				React.createElement(DetailSection, { title: "AI 说话风格" },
					React.createElement("div", { style: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 4 } },
						React.createElement("span", { style: styles.detailMeta }, `样本 ${Number(ai.message_count) || 0} 条`),
						React.createElement("span", { style: styles.detailMeta }, `幽默 ${Number(ai.humor) || 0}`),
						React.createElement("span", { style: styles.detailMeta }, `正式 ${Number(ai.formal) || 0}`),
						React.createElement("span", { style: styles.detailMeta }, `提问 ${Number(ai.questions) || 0}`),
					),
					React.createElement("div", { style: { marginTop: 3 } },
						React.createElement("div", { style: styles.detailMeta }, "常用词：", React.createElement(DetailItems, { items: countedItems(ai.words, 10), empty: "积累中" })),
						React.createElement("div", { style: styles.detailMeta }, "话题：", React.createElement(DetailItems, { items: countedItems(ai.topics, 10), empty: "积累中" })),
					)
				),
				React.createElement(DetailSection, { title: "最近时间线" },
					timeline.length > 0
						? timeline.slice(0, 20).map((item, index) => React.createElement("div", { key: `${item.date || index}:${index}`, style: { ...styles.detailItem, marginBottom: 6 } },
							React.createElement("div", { style: { color: C.text, fontWeight: 600 } }, String(item.date || "未知日期"), item.message_count ? React.createElement("span", { style: styles.detailMeta }, ` · ${item.message_count} 条`) : null),
							React.createElement("div", null, String(item.summary || "")),
							item.topics ? React.createElement("div", { style: styles.detailMeta }, `话题：${item.topics}`) : null,
							item.members ? React.createElement("div", { style: styles.detailMeta }, `活跃成员：${item.members}`) : null,
						))
						: React.createElement("div", { style: styles.detailItem }, group.timeline_available ? "暂无时间线记录" : "时间线尚未启用")
				),
				group.url ? React.createElement("div", { style: { ...styles.detailMeta, marginTop: 8, wordBreak: "break-all" } }, `控制台：${group.url}`) : null,
			);
		}

		class PageBoundary extends React.Component {
			constructor(props) {
				super(props);
				this.state = { failed: false, message: "" };
			}
			static getDerivedStateFromError(error) {
				return { failed: true, message: error && error.message ? error.message : String(error) };
			}
			render() {
				if (this.state.failed) return React.createElement("div", { style: styles.page }, React.createElement("div", { style: { ...styles.card2, ...styles.errorText } }, `微信 Agent 页面渲染失败：${this.state.message}`));
				return this.props.children;
			}
		}

		// ------------------------------------------------------------ page atoms

		function Pill({ tone, children }) {
			const tones = {
				ok: { background: "rgba(22,163,74,0.12)", color: C.ok },
				warn: { background: "rgba(194,124,14,0.14)", color: C.warn },
				error: { background: "rgba(212,56,13,0.12)", color: C.error },
				brand: { background: C.brandSoft, color: C.brand },
				muted: { background: C.hover, color: C.muted },
			};
			return React.createElement("span", { style: { ...styles.pill, ...(tones[tone] || tones.muted) } }, children);
		}

		function Banner({ tone, children }) {
			const tones = {
				ok: { background: "rgba(22,163,74,0.10)", color: C.ok },
				warn: { background: "rgba(194,124,14,0.12)", color: C.warn },
				error: { background: "rgba(212,56,13,0.10)", color: C.error },
				brand: { background: C.brandSoft, color: C.brand },
			};
			return React.createElement("div", { style: { ...styles.banner, ...(tones[tone] || tones.brand) } }, children);
		}

		function Card({ title, hint, actions, children }) {
			return React.createElement("section", { style: styles.card2 },
				title || actions ? React.createElement("div", { style: styles.cardHead },
					title ? React.createElement("span", { style: styles.cardTitle }, title) : null,
					hint ? React.createElement("span", { style: styles.cardHint }, hint) : null,
					actions ? React.createElement("span", { style: { marginLeft: "auto", display: "inline-flex", gap: 6 } }, actions) : null,
				) : null,
				children);
		}

		function Stat({ label, value, tone }) {
			return React.createElement("div", { style: styles.stat },
				React.createElement("div", { style: styles.statLabel }, label),
				React.createElement("div", { style: { ...styles.statValue, color: tone === "error" ? C.error : tone === "ok" ? C.ok : C.text } }, value),
			);
		}

		function probabilityPercent(enabled, value) {
			if (!enabled) return 0;
			const percent = Number(value) * 100;
			if (!Number.isFinite(percent)) return 0;
			return Math.round(Math.max(0, Math.min(100, percent)) * 10) / 10;
		}

		function SwitchRow({ label, enabled, probability, last }) {
			const hasProbability = probability !== undefined && probability !== null;
			const percent = probabilityPercent(Boolean(enabled), probability);
			return React.createElement("div", { style: { ...styles.switchRow, ...(last ? { borderBottom: 0 } : {}) } },
				React.createElement("span", { style: styles.switchLabel }, label),
				hasProbability
					? React.createElement("span", { style: { ...styles.switchNumber, color: enabled ? C.brand : C.muted } }, `${percent}%`)
					: React.createElement("span", { style: { ...styles.switchState, color: enabled ? C.ok : C.muted } },
						React.createElement("span", { style: { ...styles.switchDot, background: enabled ? C.ok : C.muted } }),
						enabled ? "开启" : "关闭",
					),
			);
		}

		function KV({ label, children }) {
			return React.createElement("div", { style: styles.kvRow },
				React.createElement("span", { style: styles.kvLabel }, label),
				React.createElement("span", { style: styles.kvValue }, children),
			);
		}

		function Button({ onClick, disabled, kind, children }) {
			const base = kind === "primary" ? styles.buttonPrimary : kind === "danger" ? styles.buttonDanger : styles.button;
			return React.createElement("button", { type: "button", style: { ...base, ...(disabled ? styles.buttonDisabled : {}) }, disabled: Boolean(disabled), onClick }, children);
		}

		function SubTabs({ value, options, onChange }) {
			return React.createElement("div", { style: styles.tabs }, options.map((option) =>
				React.createElement("button", { key: option.id, type: "button", style: { ...styles.tab, ...(value === option.id ? styles.activeTab : {}) }, onClick: () => onChange(option.id) }, option.label)));
		}

		function Empty({ children }) {
			return React.createElement("div", { style: styles.hint }, children);
		}

		// ---------------------------------------------------------------- 概览 tab

		function OverviewTab({ setup, onOpenDeploy }) {
			const [status, reloadStatus] = useResource(`${API_BASE}/status`, 5000);
			const [health, reloadHealth] = useResource(HEALTH_URL, 10000);
			const [action, setAction] = React.useState({ state: "idle", message: "", error: "" });
			const [confirmStop, setConfirmStop] = React.useState(false);
			const data = status.status === "ready" && status.data && typeof status.data === "object" ? status.data : null;
			const phase = data ? data.phase : null;
			const running = phase === "running" || phase === "starting";
			const stats = (data && data.stats) || {};
			const processing = (data && data.processing) || {};
			const groupNames = Array.isArray(data && data.group_names) ? data.group_names : [];
			const privateNames = Array.isArray(data && data.private_chat_names) ? data.private_chat_names : [];
			const setupData = setup && setup.status === "ready" && setup.data && typeof setup.data === "object" ? setup.data : null;
			const setupConfigured = Boolean(setupData && setupData.configured);
			const setupProbe = setupData ? setupData.probe : null;
			const setupJob = setupData ? setupData.job : null;
			const setupDeployed = Boolean(setupProbe && setupProbe.project && setupProbe.project.venv);
			const setupWechat = setupProbe && setupProbe.wechat ? setupProbe.wechat : null;

			const run = (kind) => {
				if (kind === "stop" && !confirmStop) {
					setConfirmStop(true);
					return;
				}
				setConfirmStop(false);
				setAction({ state: "running", message: `${ACTION_LABELS[kind]}中…`, error: "" });
				postJson(`${API_BASE}/${kind}`, {})
					.then((result) => {
						const restarted = result && result.restarted;
						setAction({
							state: "done",
							message: kind === "start" ? "已请求启动" : kind === "stop" ? "已请求停止" : restarted ? "已清除停机标记并重启" : "已清除停机标记",
							error: "",
						});
						reloadStatus();
						reloadHealth();
					})
					.catch((error) => setAction({ state: "error", message: "", error: errorText(error) }));
			};

			if (status.status === "loading") return React.createElement(Empty, null, "正在读取虚拟机状态…");
			if (status.status === "error") {
				return React.createElement(Card, { title: "运行状态" },
					React.createElement(Banner, { tone: "error" }, `控制台不可达：${status.error}`),
					React.createElement("div", { style: { marginTop: 10 } }, React.createElement(Button, { onClick: reloadStatus }, "重试")),
				);
			}

			const healthData = health.status === "ready" && health.data && typeof health.data === "object" ? health.data : null;
			const healthConnected = Boolean(healthData && healthData.reachable);
			const external = setupData && setupData.external && typeof setupData.external === "object" ? setupData.external : null;
			const externalLabel = external
				? external.kind === "remote_ssh"
					? `插件设置 remote_ssh：${external.username ? `${external.username}@` : ""}${external.host}${external.port ? `:${external.port}` : ""}`
					: external.kind === "remote_url"
						? `插件设置 remote_url：${external.target}`
						: "插件本机模式"
				: "";

			const connected = Boolean(setupConfigured || healthConnected);
			const vmConnectionCard = () => React.createElement(Card, { title: "虚拟机与连接", hint: setupConfigured ? "部署已配置" : healthConnected ? "已连接虚拟机" : "第一次使用先连接虚拟机" },
					setupConfigured
						? React.createElement("div", null,
							React.createElement(KV, { label: "虚拟机" }, `${setupData.connection.username}@${setupData.connection.host}:${setupData.connection.port}`),
							React.createElement(KV, { label: "部署" }, setupDeployed ? "已部署" : "还没部署（去「部署」页一键安装）"),
							setupWechat ? React.createElement(KV, { label: "微信" }, setupWechat.installed ? (setupWechat.running ? "运行中" : "已安装，未运行") : "未安装") : null,
							setupJob && setupJob.status === "running" ? React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "brand" }, `正在执行：${setupJob.title}`)) : null,
							setupJob && setupJob.status === "failed" ? React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "error" }, `上次任务失败：${setupJob.error}`)) : null,
						)
						: healthConnected
							? React.createElement("div", null,
								React.createElement(KV, { label: "虚拟机" }, externalLabel || (healthData.target || "已连接")),
								React.createElement(KV, { label: "连接" }, "已连接（不用再填一次）"),
							)
							: React.createElement(Banner, { tone: "warn" }, "还没有连接虚拟机。去「部署」页点「复制命令」→ 在虚拟机终端粘贴运行 → 把连接码粘回来，就能一键连接，不用自己查 IP 或装 SSH。"),
					healthData
						? React.createElement("div", { style: { marginTop: 8, paddingTop: 6, borderTop: `1px solid ${C.divider}` } },
							React.createElement(KV, { label: "连接状态" }, healthData.reachable ? React.createElement(Pill, { tone: "ok" }, "可达") : React.createElement(Pill, { tone: "error" }, "不可达")),
							healthData.target ? React.createElement(KV, { label: "目标" }, healthData.target) : null,
							healthData.tunnel ? React.createElement(KV, { label: "隧道" }, `${healthData.tunnel.mode || "—"}${healthData.tunnel.restarts ? ` · 重连 ${healthData.tunnel.restarts} 次` : ""}${healthData.tunnel.error ? ` · ${healthData.tunnel.error}` : ""}`) : null,
							Number.isFinite(Number(healthData.latency_ms)) ? React.createElement(KV, { label: "延迟" }, `${healthData.latency_ms} ms`) : null,
							consoleUrl(health) ? React.createElement("div", { style: { marginTop: 6 } }, React.createElement("a", { href: consoleUrl(health), target: "_blank", rel: "noreferrer", style: styles.link }, "在浏览器打开完整控制台")) : null,
							healthDetail(health) ? React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "error" }, healthDetail(health))) : null,
						)
						: health.status === "error"
							? React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "error" }, `连接信息读取失败：${health.error}`))
							: React.createElement("div", { style: { ...styles.cardHint, marginTop: 8 } }, "正在读取连接信息…"),
					React.createElement("div", { style: { marginTop: 10 } },
						React.createElement(Button, { kind: setupConfigured || healthConnected ? undefined : "primary", onClick: onOpenDeploy }, setupConfigured || healthConnected ? "打开部署与配置" : "开始连接虚拟机"),
					),
				);

			return React.createElement("div", { style: styles.section },
				connected ? null : vmConnectionCard(),

				React.createElement(Card, {
					title: "运行控制",
					hint: "写入虚拟机控制台：启动/停止会拉起或结束自动回复线程",
					actions: [
						React.createElement(Button, { key: "refresh", onClick: () => { reloadStatus(); reloadHealth(); } }, "刷新"),
					],
				},
					React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
						React.createElement(Pill, { tone: running ? "ok" : phase === "error" ? "error" : "muted" }, phaseLabel(phase)),
						React.createElement("span", { style: { color: C.muted } }, `线程${data && data.thread_alive ? "存活" : "未运行"} · 已运行 ${fmtDuration(data && data.started_at)}`),
						data && data.stop_file_present ? React.createElement(Pill, { tone: "warn" }, "停机文件存在") : null,
						React.createElement("span", { style: { marginLeft: "auto", display: "inline-flex", gap: 6, flexWrap: "wrap" } },
							React.createElement(Button, { kind: "primary", onClick: () => run("start"), disabled: running || action.state === "running" }, "启动"),
							React.createElement(Button, { kind: "danger", onClick: () => run("stop"), disabled: !running || action.state === "running" }, confirmStop ? "确认停止" : "停止"),
							React.createElement(Button, { onClick: () => run("clear-stop"), disabled: action.state === "running" }, "清除停机标记"),
						),
					),
					action.state === "running" ? React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "brand" }, action.message)) : null,
					action.state === "done" ? React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "ok" }, action.message)) : null,
					action.state === "error" ? React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "error" }, `操作失败：${action.error}`)) : null,
					data && data.last_error ? React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "error" }, `最近错误：${data.last_error}`)) : null,
					confirmStop ? React.createElement("div", { style: { ...styles.cardHint, marginTop: 6 } }, "再点一次「确认停止」才会停止；停止后自动回复线程会退出。") : null,
				),

				React.createElement(Card, { title: "回复开关", hint: "当前运行状态" },
					React.createElement("div", { style: styles.switchList },
						React.createElement(SwitchRow, { label: "发出回复", enabled: Boolean(data && data.send_enabled) }),
						React.createElement(SwitchRow, { label: "私聊回复", enabled: Boolean(data && data.private_reply_enabled) }),
						React.createElement(SwitchRow, { label: "随机主动接话", enabled: Boolean(data && data.proactive_enabled), probability: Number(data && data.proactive_probability) || 0 }),
						React.createElement(SwitchRow, { label: "表情图片", enabled: Boolean(data && data.reaction_images_enabled), probability: Number(data && data.reaction_image_probability) || 0 }),
						React.createElement(SwitchRow, { label: "语音回复", enabled: Boolean(data && data.voice_reply_enabled), probability: Number(data && data.voice_reply_probability) || 0 }),
						React.createElement(SwitchRow, { label: "人设风格过滤", enabled: Boolean(data && data.persona_style_filter), last: true }),
					),
					React.createElement("div", { style: { marginTop: 8 } },
						React.createElement(KV, { label: "主动模式" }, `${data && data.proactive_mode || "—"} · 窗口 ${data && data.proactive_window_min_minutes}-${data && data.proactive_window_max_minutes} 分 · 每小时上限 ${data && data.proactive_max_per_hour}`),
					),
				),

				React.createElement(Card, { title: "群聊与私聊" },
					React.createElement(KV, { label: "回复群" }, groupNames.length ? groupNames.map((name) => React.createElement("span", { key: name, style: { display: "inline-block", marginRight: 6, marginBottom: 2 } }, React.createElement(Pill, { tone: "brand" }, name))) : React.createElement("span", { style: { color: C.muted } }, "未配置")),
					React.createElement(KV, { label: "私聊白名单" }, privateNames.length ? `${privateNames.length} 位：${privateNames.slice(0, 6).join("、")}${privateNames.length > 6 ? " …" : ""}` : React.createElement("span", { style: { color: C.muted } }, "空（私聊服务关闭）")),
				),

				React.createElement(Card, { title: "消息统计", hint: "来自当前进程计数" },
					React.createElement("div", { style: styles.gridWide },
						React.createElement(Stat, { label: "读到", value: Number(stats.seen || 0) }),
						React.createElement(Stat, { label: "已回复", value: Number(stats.replied || 0), tone: "ok" }),
						React.createElement(Stat, { label: "跳过", value: Number(stats.skipped || 0) }),
						React.createElement(Stat, { label: "失败", value: Number(stats.failed || 0), tone: Number(stats.failed) ? "error" : undefined }),
						React.createElement(Stat, { label: "主动发言", value: Number(stats.proactive_replied || 0) }),
						React.createElement(Stat, { label: "图片回复", value: Number(stats.reaction_images || 0) }),
						React.createElement(Stat, { label: "语音回复", value: Number(stats.voice_replies || 0) }),
						React.createElement(Stat, { label: "重复问题", value: Number(stats.duplicate_questions || 0) }),
					),
				),

				React.createElement(Card, { title: "处理队列", hint: "数据库里待处理/已处理的消息" },
					React.createElement("div", { style: styles.grid },
						React.createElement(Stat, { label: "处理中", value: Number(processing.processing || 0), tone: Number(processing.processing) ? "warn" : undefined }),
						React.createElement(Stat, { label: "已发送", value: Number(processing.sent || 0), tone: "ok" }),
						React.createElement(Stat, { label: "已跳过", value: Number(processing.skipped || 0) }),
						React.createElement(Stat, { label: "失败", value: Number(processing.failed || 0), tone: Number(processing.failed) ? "error" : undefined }),
					),
				),

				connected ? vmConnectionCard() : null,
			);
		}

		// ---------------------------------------------------------------- 回声 tab

		function EchoTab() {
			const [view, setView] = React.useState("members");
			const [query, setQuery] = React.useState("");
			const [selected, setSelected] = React.useState(null);
			const [memberState, reloadMembers] = useEndpoint("/members");
			const [groupState, reloadGroups] = useEndpoint("/groups");
			const [health, reloadHealth] = useResource(HEALTH_URL, 15000);
			const members = memberState.status === "ready" && Array.isArray(memberState.data && memberState.data.members) ? memberState.data.members : [];
			const groups = groupState.status === "ready" && Array.isArray(groupState.data && groupState.data.groups) ? groupState.data.groups.filter((group) => group && String(group.group_id).endsWith("@chatroom")) : [];
			const state = view === "members" ? memberState : groupState;
			const selectedMember = selected && selected.kind === "member" ? members.find((member) => memberKey(member) === selected.key) : null;
			const selectedGroup = selected && selected.kind === "group" ? groups.find((group) => groupKey(group) === selected.key) : null;
			const reload = () => {
				if (view === "members") reloadMembers(); else reloadGroups();
				reloadHealth();
			};
			const changeView = (next) => {
				setView(next);
				setSelected(null);
			};
			const unreachable = healthDetail(health);
			const hint = selectedMember
				? `成员详情 · ${selectedMember.group_name || "未分组"}`
				: selectedGroup
					? `群像详情 · ${Number(selectedGroup.message_count) || 0} 条消息`
					: `成员好感度与群画像 · ${members.length} 位成员 / ${groups.length} 个群，点击成员或「查看详情」看详细`;
			return React.createElement(Card, {
				title: "回声",
				hint,
				actions: [
					selectedMember || selectedGroup ? null : React.createElement(SubTabs, { key: "tabs", value: view, options: [{ id: "members", label: "成员画像" }, { id: "groups", label: "群像" }], onChange: changeView }),
					React.createElement(Button, { key: "refresh", onClick: reload, disabled: state.status === "loading" }, "刷新"),
				].filter(Boolean),
			},
				unreachable ? React.createElement("div", { style: { marginBottom: 8 } }, React.createElement(Banner, { tone: "error" }, `控制台不可达：${unreachable}`)) : null,
				selectedMember
					? React.createElement(MemberDetail, { member: selectedMember, onBack: () => setSelected(null) })
					: selectedGroup
						? React.createElement(GroupDetail, { group: selectedGroup, onBack: () => setSelected(null) })
						: React.createElement("div", null,
							view === "members" ? React.createElement("input", { style: { ...styles.input, marginBottom: 8 }, value: query, onChange: (event) => setQuery(event.target.value), placeholder: "搜索成员昵称、ID 或群聊…", "aria-label": "搜索成员" }) : null,
							state.status === "loading" ? React.createElement(Empty, null, "正在读取回声…") : null,
							state.status === "error" ? React.createElement(Banner, { tone: "error" }, `读取失败：${state.error}`) : null,
							state.status === "ready" && view === "members" ? React.createElement(MembersList, {
								members,
								query,
								selectedKey: selected && selected.kind === "member" ? selected.key : "",
								onSelect: (member) => setSelected({ kind: "member", key: memberKey(member) }),
							}) : null,
							state.status === "ready" && view === "groups" ? React.createElement(GroupsList, {
								groups,
								selectedKey: selected && selected.kind === "group" ? selected.key : "",
								onSelect: (group) => setSelected({ kind: "group", key: groupKey(group) }),
							}) : null,
						),
			);
		}

		// ---------------------------------------------------------------- 日志 tab

		function LogsTab() {
			const [view, setView] = React.useState("events");
			const [auto, setAuto] = React.useState(true);
			const [level, setLevel] = React.useState("ALL");
			const [events, reloadEvents] = useResource(`${API_BASE}/events`, auto ? 4000 : 0);
			const [replies, reloadReplies] = useResource(`${API_BASE}/replies`, 0);
			const [audit, reloadAudit] = useResource(`${API_BASE}/audit`, 0);
			const eventList = Array.isArray(events.data) ? events.data : [];
			const replyList = Array.isArray(replies.data) ? replies.data : [];
			const auditList = Array.isArray(audit.data) ? audit.data : [];
			const filtered = level === "ALL" ? eventList : eventList.filter((event) => String(event.level || "INFO").toUpperCase().startsWith(level));
			const refresh = () => {
				if (view === "events") reloadEvents();
				else if (view === "replies") reloadReplies();
				else reloadAudit();
			};
			const active = view === "events" ? events : view === "replies" ? replies : audit;
			return React.createElement(Card, {
				title: "日志",
				hint: "事件流 / 回复记录 / 发送审计，全部来自虚拟机",
				actions: [
					React.createElement(SubTabs, { key: "tabs", value: view, options: [{ id: "events", label: "事件" }, { id: "replies", label: "回复" }, { id: "audit", label: "发送审计" }], onChange: setView }),
					React.createElement(Button, { key: "auto", onClick: () => setAuto((value) => !value) }, auto ? "自动刷新：开" : "自动刷新：关"),
					React.createElement(Button, { key: "refresh", onClick: refresh, disabled: active.status === "loading" }, "刷新"),
				],
			},
				active.error ? React.createElement("div", { style: { marginBottom: 8 } }, React.createElement(Banner, { tone: "warn" }, `刷新失败，显示上次结果：${active.error}`)) : null,
				view === "events" ? React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" } },
					["ALL", "INFO", "WARN", "ERROR"].map((item) => React.createElement("button", { key: item, type: "button", style: { ...styles.chip, ...(level === item ? styles.chipActive : {}) }, onClick: () => setLevel(item) }, item === "ALL" ? "全部" : item)),
					React.createElement("span", { style: { ...styles.cardHint, marginLeft: "auto" } }, `${filtered.length} 条`),
				) : null,
				active.status === "loading" ? React.createElement(Empty, null, "正在读取日志…") : null,
				view === "events" && active.status === "ready" ? (filtered.length === 0 ? React.createElement(Empty, null, "暂无事件") : filtered.map((event, index) =>
					React.createElement("div", { key: `${event.id || index}`, style: styles.listRow },
						React.createElement("span", { style: styles.mono }, fmtTime(event.created_at || event.at || event.time)),
						React.createElement(Pill, { tone: LEVEL_TONES[String(event.level || "INFO").toUpperCase()] || "muted" }, String(event.level || "INFO")),
						React.createElement("span", { style: { ...styles.mono, color: C.secondary } }, String(event.source || "")),
						React.createElement("span", { style: styles.wrapText }, String(event.message || "")),
					))) : null,
				view === "replies" && active.status === "ready" ? (replyList.length === 0 ? React.createElement(Empty, null, "暂无回复记录") : replyList.map((reply, index) =>
					React.createElement("div", { key: `${reply.event_key || index}`, style: { ...styles.listRow, flexWrap: "wrap" } },
						React.createElement("span", { style: styles.mono }, fmtTime(reply.updated_at || reply.created_at)),
						React.createElement(Pill, { tone: STATUS_TONES[String(reply.status || "").toLowerCase()] || "muted" }, String(reply.status || "—")),
						React.createElement("span", { style: { color: C.secondary, flex: "none" } }, `${reply.group_name || "私聊"} · ${reply.member_name || "成员"}`),
						React.createElement("span", { style: styles.truncate, title: String(reply.text || "") }, String(reply.text || "").slice(0, 120)),
						reply.reply_text ? React.createElement("span", { style: { ...styles.truncate, color: C.brand, flexBasis: "100%", marginLeft: 118 } }, `↳ ${String(reply.reply_text).slice(0, 160)}`) : null,
						reply.reason && reply.status !== "sent" ? React.createElement("span", { style: { ...styles.mono, flexBasis: "100%", marginLeft: 118 } }, `原因：${reply.reason}`) : null,
					))) : null,
				view === "audit" && active.status === "ready" ? (auditList.length === 0 ? React.createElement(Empty, null, "暂无发送审计") : auditList.map((item, index) =>
					React.createElement("div", { key: `${item.id || index}`, style: { ...styles.listRow, flexWrap: "wrap" } },
						React.createElement("span", { style: styles.mono }, fmtTime(item.created_at)),
						React.createElement(Pill, { tone: item.allowed ? "ok" : "error" }, item.allowed ? "允许" : "拒绝"),
						React.createElement("span", { style: { color: C.secondary, flex: "none" } }, `${item.action_type || "reply"}${item.target_member_id ? ` · ${item.target_member_id}` : ""}`),
						React.createElement("span", { style: styles.truncate, title: String(item.text || "") }, String(item.text || "").slice(0, 140)),
						item.reason && !item.allowed ? React.createElement("span", { style: { ...styles.mono, flexBasis: "100%", marginLeft: 118 } }, `原因：${item.reason}`) : null,
					))) : null,
			);
		}

		// ---------------------------------------------------------------- 平台 tab

		function platformLabel(id) {
			return id === "douyin" ? "抖音" : id === "xiaohongshu" ? "小红书" : String(id || "平台");
		}

		function identityTitle(identity) {
			const name = identity.platform_user_name || identity.platform_user_id || "未知账号";
			return `${platformLabel(identity.platform)} @${name}`;
		}

		function PlatformTab() {
			const [status, reloadStatus] = useResource(`${API_BASE}/platforms`, 15000);
			const [identities, reloadIdentities] = useResource(`${API_BASE}/platform-identities`, 0);
			const [actions, reloadActions] = useResource(`${API_BASE}/platform-actions`, 0);
			const [memories, reloadMemories] = useResource(`${API_BASE}/platform-memories?limit=50`, 0);
			const [members, reloadMembers] = useResource(`${API_BASE}/members`, 0);
			const [proactive, reloadProactive] = useResource(`${API_BASE}/platform-proactive`, 0);
			const [notice, setNotice] = React.useState({ tone: "", text: "" });
			const [busy, setBusy] = React.useState("");
			const [browse, setBrowse] = React.useState({ platform: "xiaohongshu", query: "", state: "idle", items: [], comments: [], itemId: "", error: "" });
			const [compose, setCompose] = React.useState({ item: null, text: "", mentionIds: [], dryRun: true, result: null, error: "" });
			const [bindForm, setBindForm] = React.useState({ platform: "xiaohongshu", userId: "", userName: "", memberId: "" });

			const statusData = status.status === "ready" && status.data ? status.data : {};
			const platformIds = Object.keys(statusData).length ? Object.keys(statusData) : ["douyin", "xiaohongshu"];
			const identityPayload = identities.status === "ready" && identities.data ? identities.data : {};
			const identityList = Array.isArray(identityPayload.identities) ? identityPayload.identities : [];
			const allowlists = identityPayload.mention_allowlist || identityPayload.allowlists || {};
			const actionList = actions.status === "ready" && Array.isArray(actions.data) ? actions.data : [];
			const memoryList = memories.status === "ready" && memories.data && Array.isArray(memories.data.memories) ? memories.data.memories : [];
			const memberList = members.status === "ready" && members.data && Array.isArray(members.data.members) ? members.data.members : [];
			const proactiveData = proactive.status === "ready" && proactive.data ? proactive.data : null;
			const seenMembers = new Set();
			const memberOptions = memberList.filter((member) => {
				const id = String(member.member_id || "");
				if (!id || seenMembers.has(id)) return false;
				seenMembers.add(id);
				return true;
			});
			const composeIdentities = compose.item ? identityList.filter((identity) => identity.platform === compose.item.platform) : [];

			const fail = (error) => setNotice({ tone: "error", text: errorText(error) });
			const ok = (text) => setNotice({ tone: "ok", text });

			const refreshAll = () => {
				reloadStatus();
				reloadIdentities();
				reloadActions();
				reloadMemories();
				reloadProactive();
			};

			const openPlatform = (platform) => {
				setBusy(`open:${platform}`);
				postJson(`${API_BASE}/platforms/open`, { platform })
					.then(() => { ok(`已打开${platformLabel(platform)}浏览器：第一次使用请在虚拟机桌面扫码登录。`); reloadStatus(); })
					.catch(fail)
					.finally(() => setBusy(""));
			};
			const closePlatform = (platform) => {
				setBusy(`close:${platform}`);
				postJson(`${API_BASE}/platforms/close`, { platform })
					.then(() => { ok(`已关闭${platformLabel(platform)}浏览器。`); reloadStatus(); })
					.catch(fail)
					.finally(() => setBusy(""));
			};

			const runBrowse = () => {
				if (!browse.query.trim()) {
					fail(new Error("先填一个想浏览的关键词"));
					return;
				}
				setBusy("browse");
				postJson(`${API_BASE}/platforms/browse`, { platform: browse.platform, query: browse.query.trim(), limit: 10 })
					.then((items) => {
						setBrowse((prev) => ({ ...prev, state: "ready", items: Array.isArray(items) ? items : [], comments: [], itemId: "", error: "" }));
						ok(`已浏览 ${Array.isArray(items) ? items.length : 0} 条${platformLabel(browse.platform)}内容。`);
					})
					.catch((error) => {
						fail(error);
						setBrowse((prev) => ({ ...prev, state: "error", error: errorText(error) }));
					})
					.finally(() => setBusy(""));
			};

			const loadComments = (item) => {
				setBusy(`comments:${item.item_id}`);
				postJson(`${API_BASE}/platform-comments`, { platform: item.platform, item_id: item.item_id, limit: 20 })
					.then((comments) => {
						setBrowse((prev) => ({ ...prev, comments: Array.isArray(comments) ? comments : [], itemId: item.item_id }));
					})
					.catch(fail)
					.finally(() => setBusy(""));
			};

			const openCompose = (item) => {
				const linked = identityList.filter((identity) => identity.platform === item.platform);
				const first = linked[0];
				const mention = first ? first.platform_user_name || first.platform_user_id : "";
				const title = String(item.title || item.text || "这篇内容").slice(0, 40);
				setCompose({
					item,
					text: `看到这篇${title}，觉得挺适合你～${mention ? `@${mention} ` : ""}可以先看看～`,
					mentionIds: first ? [first.platform_user_id] : [],
					dryRun: true,
					result: null,
					error: "",
				});
			};

			const toggleMention = (platformUserId) => {
				setCompose((prev) => {
					const exists = prev.mentionIds.includes(platformUserId);
					return { ...prev, mentionIds: exists ? prev.mentionIds.filter((value) => value !== platformUserId) : [...prev.mentionIds, platformUserId] };
				});
			};

			const planComment = () => {
				if (!compose.item) return;
				if (!compose.text.trim()) {
					fail(new Error("评论内容不能为空"));
					return;
				}
				setBusy("plan");
				postJson(`${API_BASE}/platform-actions/plan`, {
					platform: compose.item.platform,
					action_type: "comment",
					item_id: compose.item.item_id,
					text: compose.text.trim(),
					mention_ids: compose.mentionIds,
					dry_run: compose.dryRun,
				})
					.then((receipt) => {
						setCompose((prev) => ({ ...prev, result: receipt, error: "" }));
						reloadActions();
						ok(receipt && receipt.dry_run ? "已生成 dry-run 评论计划（不会真的发送）。" : "已排队评论计划，可在动作台账里确认执行。");
					})
					.catch((error) => {
						setCompose((prev) => ({ ...prev, error: errorText(error) }));
						fail(error);
					})
					.finally(() => setBusy(""));
			};

			const executeAction = (action) => {
				if (!window.confirm(`确认在${platformLabel(action.platform)}上真实发送这条${action.action_type === "reply" ? "回复" : "评论"}吗？\n\n${String(action.text || "").slice(0, 200)}`)) return;
				setBusy(`execute:${action.action_key}`);
				postJson(`${API_BASE}/platform-actions/execute`, { action_key: action.action_key, confirm: true })
					.then((result) => { ok(result && result.status === "sent" ? "已发送，并在页面上回读确认。" : `执行结果：${result && result.status}`); refreshAll(); })
					.catch(fail)
					.finally(() => setBusy(""));
			};

			const bindIdentity = () => {
				const member = memberOptions.find((item) => String(item.member_id) === bindForm.memberId);
				if (!bindForm.userId.trim() || !bindForm.memberId) {
					fail(new Error("需要填平台用户 ID，并选择一个微信成员"));
					return;
				}
				setBusy("bind");
				postJson(`${API_BASE}/platform-identities`, {
					platform: bindForm.platform,
					platform_user_id: bindForm.userId.trim(),
					platform_user_name: bindForm.userName.trim(),
					member_id: bindForm.memberId,
					member_name: member ? String(member.member_name || "") : "",
				})
					.then(() => {
						ok(`已把${platformLabel(bindForm.platform)}账号和微信成员关联，@ 白名单会自动带上这个平台 ID。`);
						setBindForm((prev) => ({ ...prev, userId: "", userName: "" }));
						refreshAll();
					})
					.catch(fail)
					.finally(() => setBusy(""));
			};

			const unbindIdentity = (identity) => {
				if (!window.confirm(`解绑 ${identityTitle(identity)} 与微信成员「${identity.member_name || identity.member_id}」的关联吗？`)) return;
				setBusy(`unbind:${identity.id}`);
				postJson(`${API_BASE}/platform-identities/delete`, { id: identity.id })
					.then(() => { ok("已解绑。"); refreshAll(); })
					.catch(fail)
					.finally(() => setBusy(""));
			};

			const runProactive = () => {
				setBusy("proactive");
				postJson(`${API_BASE}/platform-proactive/run`, {})
					.then((result) => { ok(result && result.reason ? `主动浏览已执行：${result.reason}` : "主动浏览已执行一轮（默认只生成计划）。"); refreshAll(); })
					.catch(fail)
					.finally(() => setBusy(""));
			};

			const accountsCard = React.createElement(Card, { title: "账号状态", hint: "登录态保存在虚拟机浏览器目录里，第一次使用点「打开浏览器」后扫码" },
				platformIds.map((platform) => {
					const item = statusData[platform] || {};
					return React.createElement("div", { key: platform, style: { ...styles.listRow, flexWrap: "wrap" } },
						React.createElement(Pill, { tone: item.logged_in ? "ok" : "muted" }, `${platformLabel(platform)} · ${item.logged_in ? "已登录" : "未登录"}`),
						React.createElement("span", { style: styles.mono }, `${item.mode || "dry_run"}${item.account_id ? ` · ${item.account_id}` : ""}`),
						React.createElement("span", { style: styles.truncate }, `@ 白名单 ${Number(item.mention_allowlist_count) || 0} 个：${(item.mention_allowlist_ids || []).join("、") || "（空）"}`),
						React.createElement(Button, { onClick: () => openPlatform(platform), disabled: busy === `open:${platform}` }, "打开浏览器"),
						React.createElement(Button, { onClick: () => closePlatform(platform), disabled: busy === `close:${platform}` }, "关闭"),
					);
				}),
				status.status === "error" ? React.createElement("div", { style: styles.errorText }, `读取平台状态失败：${status.error}`) : null,
				React.createElement("div", { style: styles.hint }, "没有安装 TikTok / 小红书客户端也没关系：插件用虚拟机里的可见浏览器访问网页版，登录一次即可。"),
			);

			const bindCard = React.createElement(Card, { title: "账号关联（三号互联）", hint: "把平台账号绑到微信成员，@ 白名单和共享记忆都会自动带上" },
				React.createElement("div", { style: { ...styles.grid, marginBottom: 8 } },
					React.createElement("label", { style: { display: "flex", flexDirection: "column", gap: 3 } },
						React.createElement("span", { style: styles.kvLabel }, "平台"),
						React.createElement("select", { value: bindForm.platform, style: styles.input, onChange: (event) => setBindForm((prev) => ({ ...prev, platform: event.target.value })) },
							Object.keys(allowlists).length ? Object.keys(allowlists).map((platform) => React.createElement("option", { key: platform, value: platform }, platformLabel(platform))) : ["douyin", "xiaohongshu"].map((platform) => React.createElement("option", { key: platform, value: platform }, platformLabel(platform))),
						),
					),
					React.createElement("label", { style: { display: "flex", flexDirection: "column", gap: 3 } },
						React.createElement("span", { style: styles.kvLabel }, "平台用户 ID（稳定 ID，不是昵称）"),
						React.createElement("input", { value: bindForm.userId, placeholder: "例如 xhs_12345 / uid_123", style: styles.input, onChange: (event) => setBindForm((prev) => ({ ...prev, userId: event.target.value })) }),
					),
					React.createElement("label", { style: { display: "flex", flexDirection: "column", gap: 3 } },
						React.createElement("span", { style: styles.kvLabel }, "平台显示名（@ 候选用）"),
						React.createElement("input", { value: bindForm.userName, placeholder: "例如 小明", style: styles.input, onChange: (event) => setBindForm((prev) => ({ ...prev, userName: event.target.value })) }),
					),
					React.createElement("label", { style: { display: "flex", flexDirection: "column", gap: 3 } },
						React.createElement("span", { style: styles.kvLabel }, "微信成员"),
						React.createElement("select", { value: bindForm.memberId, style: styles.input, onChange: (event) => setBindForm((prev) => ({ ...prev, memberId: event.target.value })) },
							React.createElement("option", { value: "" }, "选择微信成员…"),
							memberOptions.map((member) => React.createElement("option", { key: member.member_id, value: String(member.member_id) }, `${member.member_name || member.member_id}（${member.member_id}）`)),
						),
					),
				),
				React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" } },
					React.createElement(Button, { kind: "primary", onClick: bindIdentity, disabled: busy === "bind" }, "绑定平台账号"),
					React.createElement(Button, { onClick: reloadIdentities }, "刷新人设关联"),
					React.createElement(Button, { onClick: reloadMembers }, "刷新微信成员"),
					React.createElement("span", { style: styles.hint }, "平台显示名只用于 @ 候选；授权仍只认稳定 ID。"),
				),
				identityList.length === 0
					? React.createElement(Empty, null, "还没有平台账号关联。绑定后，群里让「她」去小红书/抖音找人时才能 @ 到对应的人。")
					: React.createElement("div", { style: { marginTop: 4 } }, identityList.map((identity) => React.createElement("div", { key: identity.id, style: { ...styles.listRow, flexWrap: "wrap" } },
						React.createElement(Pill, { tone: "brand" }, platformLabel(identity.platform)),
						React.createElement("span", { style: styles.truncate }, `${identityTitle(identity)} → ${identity.member_name || identity.member_id}（${identity.member_id}）`),
						React.createElement(Button, { onClick: () => unbindIdentity(identity), disabled: busy === `unbind:${identity.id}` }, "解绑"),
					))),
				Object.keys(allowlists).length ? React.createElement("div", { style: { ...styles.chips, marginTop: 8 } },
					Object.keys(allowlists).map((platform) => React.createElement("span", { key: platform, style: styles.badge }, `${platformLabel(platform)} @ ID：${(allowlists[platform] || []).join("、") || "（空）"}`)),
				) : null,
			);

			const browseCard = React.createElement(Card, { title: "浏览与评论", hint: "先浏览公开内容，再挑一篇写评论；默认只生成 dry-run 计划" },
				React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 } },
					React.createElement("select", { value: browse.platform, style: { ...styles.input, width: 120 }, onChange: (event) => setBrowse((prev) => ({ ...prev, platform: event.target.value })) },
						platformIds.map((platform) => React.createElement("option", { key: platform, value: platform }, platformLabel(platform))),
					),
					React.createElement("input", { value: browse.query, placeholder: "关键词，例如 看海攻略", style: { ...styles.input, flex: 1, minWidth: 180 }, onChange: (event) => setBrowse((prev) => ({ ...prev, query: event.target.value })), onKeyDown: (event) => { if (event.key === "Enter") runBrowse(); } }),
					React.createElement(Button, { kind: "primary", onClick: runBrowse, disabled: busy === "browse" }, "浏览"),
				),
				browse.state === "loading" || busy === "browse" ? React.createElement(Empty, null, "正在打开平台页面读取内容…") : null,
				browse.state === "error" ? React.createElement("div", { style: styles.errorText }, `浏览失败：${browse.error}`) : null,
				browse.state === "ready" && browse.items.length === 0 ? React.createElement(Empty, null, "没有读到内容：确认已经在虚拟机里登录了对应平台。") : null,
				browse.state === "ready" && browse.items.length > 0
					? React.createElement("div", null, browse.items.map((item, index) => React.createElement("div", { key: `${item.item_id || index}`, style: { ...styles.listRow, flexWrap: "wrap" } },
						React.createElement("span", { style: styles.mono }, `${index + 1}`),
						React.createElement("span", { style: styles.wrapText }, React.createElement("div", { style: { fontWeight: 600 } }, String(item.title || item.text || item.item_id || "未命名内容").slice(0, 100)), React.createElement("div", { style: { color: C.muted } }, `${item.author_name || item.author_id || "未知作者"} · ${String(item.text || "").slice(0, 120)}`)),
						React.createElement(Button, { onClick: () => loadComments(item), disabled: busy === `comments:${item.item_id}` }, "读评论"),
						React.createElement(Button, { onClick: () => openCompose(item) }, "写评论"),
					)))
					: null,
				browse.itemId && browse.comments.length > 0
					? React.createElement("div", { style: { marginTop: 6 } },
						React.createElement("div", { style: styles.cardTitle }, `公开评论 ${browse.comments.length} 条`),
						browse.comments.slice(0, 20).map((comment, index) => React.createElement("div", { key: `${comment.comment_id || index}`, style: styles.row },
							React.createElement("span", { style: styles.truncate }, `${comment.author_name || comment.author_id || "匿名"}：${String(comment.text || "").slice(0, 120)}`),
						)),
					)
					: null,
				compose.item ? React.createElement("div", { style: { marginTop: 10, borderTop: `1px solid ${C.divider}`, paddingTop: 8 } },
					React.createElement("div", { style: styles.cardTitle }, `写评论 · ${platformLabel(compose.item.platform)} · ${String(compose.item.title || compose.item.item_id || "").slice(0, 60)}`),
					React.createElement("textarea", { value: compose.text, rows: 4, style: { ...styles.input, minHeight: 72, marginTop: 6, resize: "vertical" }, onChange: (event) => setCompose((prev) => ({ ...prev, text: event.target.value })) }),
					composeIdentities.length
						? React.createElement("div", { style: { ...styles.chips, marginTop: 6 } },
							React.createElement("span", { style: styles.hint }, "@ 关联的人："),
							composeIdentities.map((identity) => React.createElement("label", { key: identity.id, style: { ...styles.chip, ...(compose.mentionIds.includes(identity.platform_user_id) ? styles.chipActive : {}), display: "inline-flex", alignItems: "center", gap: 5 } },
								React.createElement("input", { type: "checkbox", checked: compose.mentionIds.includes(identity.platform_user_id), onChange: () => toggleMention(identity.platform_user_id) }),
								`@${identity.platform_user_name || identity.platform_user_id}`,
							)),
						)
						: React.createElement("div", { style: styles.hint }, "这个平台还没有关联微信成员，可以在上面「账号关联」里绑定后再 @。"),
					React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 6 } },
						React.createElement("label", { style: { display: "inline-flex", alignItems: "center", gap: 5, color: C.secondary } },
							React.createElement("input", { type: "checkbox", checked: compose.dryRun, onChange: (event) => setCompose((prev) => ({ ...prev, dryRun: event.target.checked })) }),
							"dry-run（只生成计划，不发送）",
						),
						React.createElement(Button, { kind: "primary", onClick: planComment, disabled: busy === "plan" }, "生成评论计划"),
						React.createElement(Button, { onClick: () => setCompose({ item: null, text: "", mentionIds: [], dryRun: true, result: null, error: "" }) }, "收起"),
					),
					compose.result ? React.createElement("div", { style: { marginTop: 6 } },
						React.createElement(KV, { label: "计划" }, `${compose.result.status || "queued"} · dry_run=${String(compose.result.dry_run)}${compose.result.duplicate ? " · 重复计划已合并" : ""}`),
						React.createElement(KV, { label: "action_key" }, React.createElement("span", { style: styles.mono }, String(compose.result.action_key || ""))),
						React.createElement(KV, { label: "原因" }, String(compose.result.reason || "—")),
					) : null,
					compose.error ? React.createElement("div", { style: styles.errorText }, compose.error) : null,
					React.createElement("div", { style: styles.hint }, "真实发送需要先打开设置里的「允许平台评论」并关闭 dry-run，然后在动作台账二次确认；验证码/登录失效会停手。"),
				) : null,
			);

			const actionsCard = React.createElement(Card, { title: "动作台账", hint: "评论/回复计划与发送记录", actions: React.createElement(Button, { onClick: reloadActions }, "刷新") },
				actionList.length === 0 ? React.createElement(Empty, null, "还没有平台动作记录。") : actionList.map((action) => React.createElement("div", { key: action.action_key, style: { ...styles.listRow, flexWrap: "wrap" } },
					React.createElement("span", { style: styles.mono }, fmtTime(action.created_at)),
					React.createElement(Pill, { tone: action.status === "sent" ? "ok" : action.status === "failed" ? "error" : action.dry_run ? "muted" : "warn" }, `${action.status}${action.dry_run ? " · dry-run" : ""}`),
					React.createElement("span", { style: { color: C.secondary, flex: "none" } }, `${platformLabel(action.platform)} · ${action.action_type === "reply" ? "回复" : "评论"}`),
					React.createElement("span", { style: styles.truncate, title: String(action.text || "") }, String(action.text || "").slice(0, 140)),
					!action.dry_run && action.status === "queued" ? React.createElement(Button, { onClick: () => executeAction(action), disabled: busy === `execute:${action.action_key}` }, "确认执行") : null,
				)),
			);

			const memoriesCard = React.createElement(Card, { title: "平台记忆（三号共享）", hint: "浏览、读评论、发评论都会记下来，回复时可以跨平台用", actions: React.createElement(Button, { onClick: reloadMemories }, "刷新") },
				memoryList.length === 0 ? React.createElement(Empty, null, "还没有平台记忆。") : memoryList.slice(0, 30).map((memory, index) => React.createElement("div", { key: `${memory.id || index}`, style: styles.listRow },
					React.createElement(Pill, { tone: "brand" }, platformLabel(memory.platform)),
					React.createElement("span", { style: styles.mono }, String(memory.kind || "")),
					React.createElement("span", { style: styles.truncate, title: String(memory.text || memory.title || "") }, `${memory.member_name || memory.member_id || "未关联"} · ${String(memory.title || memory.text || "").slice(0, 120)}`),
					React.createElement("span", { style: styles.mono }, fmtTime(memory.created_at)),
				)),
			);

			const proactiveCard = React.createElement(Card, { title: "主动浏览", hint: "按间隔浏览配置的关键词，把值得评论的内容先排进计划", actions: React.createElement(Button, { onClick: runProactive, disabled: busy === "proactive" }, "立即跑一轮") },
				proactiveData ? React.createElement("div", null,
					React.createElement(KV, { label: "开关" }, proactiveData.enabled ? React.createElement(Pill, { tone: "ok" }, "已开启") : React.createElement(Pill, { tone: "muted" }, "未开启")),
					React.createElement(KV, { label: "间隔" }, `${Number(proactiveData.interval_minutes) || 0} 分钟`),
					React.createElement(KV, { label: "关键词" }, Array.isArray(proactiveData.keywords) && proactiveData.keywords.length ? proactiveData.keywords.join("、") : "（空：从人设/兴趣记忆取词）"),
					React.createElement(KV, { label: "上次运行" }, proactiveData.last_run_at ? `${fmtTime(proactiveData.last_run_at)} · ${proactiveData.last_result || (proactiveData.last_result_detail && proactiveData.last_result_detail.reason) || "—"}` : "还没运行"),
					proactiveData.quiet_hours ? React.createElement(KV, { label: "静默时段" }, String(proactiveData.quiet_hours)) : null,
				) : React.createElement(Empty, null, proactive.status === "error" ? `读取失败：${proactive.error}` : "正在读取主动浏览状态…"),
				React.createElement("div", { style: styles.hint }, "开关、间隔、关键词在「设置 → 平台」里改；默认只生成 dry-run 计划。"),
			);

			return React.createElement("div", { style: styles.section },
				React.createElement(Banner, { tone: "brand" }, "三号互联：平台账号关联微信成员后，@ 白名单和记忆会自动共享。所有平台写操作默认 dry-run；真实发送需要「允许平台评论」开关 + 动作台账二次确认，遇到验证码/登录失效会停下。"),
				notice.text ? React.createElement(Banner, { tone: notice.tone || "brand" }, notice.text) : null,
				accountsCard,
				bindCard,
				browseCard,
				actionsCard,
				memoriesCard,
				proactiveCard,
			);
		}

		// ---------------------------------------------------------------- 设置 tab

		function fieldBaseline(field, values) {
			const raw = values[field.env];
			if (field.type === "checkbox") return Boolean(raw);
			if (raw === null || raw === undefined) return "";
			return String(raw);
		}

		function fieldCurrent(field, values, draft) {
			if (Object.prototype.hasOwnProperty.call(draft, field.env)) return draft[field.env];
			return fieldBaseline(field, values);
		}

		function Field({ field, value, configured, cleared, onChange, onClear }) {
			const type = field.type || "text";
			const label = String(field.label || field.env);
			const tip = String(field.description || "");
			const control = type === "checkbox"
				? React.createElement("input", { type: "checkbox", checked: Boolean(value), onChange: (event) => onChange(event.target.checked), style: { width: 15, height: 15 } })
				: type === "select"
					? React.createElement("select", { value: String(value ?? ""), onChange: (event) => onChange(event.target.value), style: { ...styles.input, maxWidth: 320 } },
						(Array.isArray(field.options) ? field.options : []).map((option) => React.createElement("option", { key: option, value: option }, option)))
					: React.createElement("input", {
						type: field.secret ? "password" : type === "number" ? "number" : "text",
						value: String(value ?? ""),
						placeholder: field.secret && configured ? "已配置，留空保持不变" : "",
						onChange: (event) => onChange(event.target.value),
						style: { ...styles.input, maxWidth: 420 },
					});
			return React.createElement("div", { style: styles.fieldRow },
				React.createElement("div", { style: styles.fieldTop },
					React.createElement("span", { style: styles.fieldLabel },
						React.createElement("div", null, label, field.secret ? React.createElement("span", { style: { ...styles.badge, marginLeft: 6 } }, configured ? "已配置" : "未配置") : null),
						tip ? React.createElement("div", { style: styles.fieldTip }, tip) : null,
					),
					React.createElement("span", { style: { flex: "none", display: "inline-flex", alignItems: "center", gap: 6 } },
						field.secret ? React.createElement("label", { style: { ...styles.cardHint, display: "inline-flex", alignItems: "center", gap: 4 } },
							React.createElement("input", { type: "checkbox", checked: Boolean(cleared), onChange: (event) => onClear(event.target.checked) }),
							"清除",
						) : null,
						control,
					),
				),
			);
		}

		// 人设文件 / 文件夹拖拽上传（写入虚拟机 personas/，不覆盖 .env）
		const PERSONA_TEXT_EXTENSIONS = [".md", ".markdown", ".txt", ".json", ".yaml", ".yml", ".toml", ".ini", ".csv"];
		const PERSONA_UPLOAD_MAX_FILES = 200;
		const PERSONA_UPLOAD_MAX_BYTES = 5_000_000;

		function personaTextFile(name) {
			const lower = String(name || "").toLowerCase();
			return PERSONA_TEXT_EXTENSIONS.some((extension) => lower.endsWith(extension));
		}

		function personaSlug(name) {
			return String(name || "").trim().replace(/[^A-Za-z0-9._\-\u4e00-\u9fff]/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 64);
		}

		function readDirectoryEntries(reader) {
			return new Promise((resolve) => {
				const entries = [];
				const read = () => reader.readEntries((batch) => {
					if (!batch || batch.length === 0) {
						resolve(entries);
						return;
					}
					entries.push(...batch);
					read();
				}, () => resolve(entries));
				read();
			});
		}

		function entryFile(entry) {
			return new Promise((resolve, reject) => entry.file(resolve, reject));
		}

		async function walkDirectoryEntry(entry, prefix, output) {
			const children = await readDirectoryEntries(entry.createReader());
			for (const child of children) {
				if (child.isFile) {
					const file = await entryFile(child);
					output.push({ path: prefix ? `${prefix}/${file.name}` : file.name, file });
				} else if (child.isDirectory) {
					await walkDirectoryEntry(child, prefix ? `${prefix}/${child.name}` : child.name, output);
				}
			}
		}

		async function collectDroppedEntries(dataTransfer) {
			const items = dataTransfer && dataTransfer.items ? Array.from(dataTransfer.items) : [];
			const entries = [];
			for (const item of items) {
				if (!item || item.kind !== "file" || typeof item.webkitGetAsEntry !== "function") continue;
				const entry = item.webkitGetAsEntry();
				if (entry) entries.push(entry);
			}
			const collected = [];
			let target = "";
			if (entries.length === 1 && entries[0].isDirectory) {
				target = entries[0].name;
				await walkDirectoryEntry(entries[0], "", collected);
			} else {
				for (const entry of entries) {
					if (entry.isDirectory) {
						await walkDirectoryEntry(entry, entry.name, collected);
					} else if (entry.isFile) {
						const file = await entryFile(entry);
						collected.push({ path: file.name, file });
					}
				}
			}
			return { target, entries: collected };
		}

		function collectInputFiles(fileList) {
			const files = Array.from(fileList || []);
			const paths = files.map((file) => String(file.webkitRelativePath || file.name || ""));
			const first = paths.find((path) => path.includes("/")) || "";
			const folder = first ? first.split("/")[0] : "";
			return {
				target: folder,
				entries: files.map((file, index) => {
					let path = paths[index];
					// 目录选择器给出的相对路径以所选文件夹开头，上传目标是这个人设目录本身，
					// 所以把第一段文件夹名去掉，保留 references/ 之类的子目录。
					if (folder && path.startsWith(`${folder}/`)) path = path.slice(folder.length + 1);
					return { path, file };
				}),
			};
		}

		function PersonaUploadCard({ onSaved }) {
			const [personas, reloadPersonas] = useResource(`${API_BASE}/personas`, 0);
			const [files, setFiles] = React.useState([]);
			const [target, setTarget] = React.useState("");
			const [overwrite, setOverwrite] = React.useState(false);
			const [apply, setApply] = React.useState(true);
			const [status, setStatus] = React.useState({ state: "idle", message: "", error: "" });
			const [dragActive, setDragActive] = React.useState(false);
			const fileInputRef = React.useRef(null);
			const folderInputRef = React.useRef(null);

			const snapshot = personas.status === "ready" && personas.data && typeof personas.data === "object" ? personas.data : null;
			const current = snapshot && snapshot.current ? snapshot.current : null;
			const known = snapshot && Array.isArray(snapshot.personas) ? snapshot.personas : [];

			const loadFiles = async (collected, suggestedTarget) => {
				const accepted = [];
				const rejected = [];
				let total = 0;
				for (const item of collected) {
					if (!personaTextFile(item.path)) {
						rejected.push(item.path);
						continue;
					}
					if (accepted.length >= PERSONA_UPLOAD_MAX_FILES) {
						rejected.push(`${item.path}（文件数超过 ${PERSONA_UPLOAD_MAX_FILES}）`);
						continue;
					}
					total += item.file.size;
					accepted.push(item);
				}
				if (total > PERSONA_UPLOAD_MAX_BYTES) {
					setStatus({ state: "error", message: "", error: `文本文件总大小 ${(total / 1024 / 1024).toFixed(1)} MB，超过 5 MB 上限；请只放人设的 Markdown/文本文件。` });
					return;
				}
				if (accepted.length === 0) {
					setStatus({ state: "error", message: "", error: rejected.length ? `只支持文本文件（.md/.txt/.json/.yaml/.ini/.csv），已忽略：${rejected.slice(0, 5).join("、")}` : "没有读到可上传的文件。" });
					return;
				}
				try {
					const loaded = [];
					for (const item of accepted) loaded.push({ path: item.path, content: await item.file.text(), size: item.file.size });
					setFiles(loaded);
					if (suggestedTarget && !target.trim()) setTarget(personaSlug(suggestedTarget) || "我的新人设");
					setStatus({ state: "idle", message: rejected.length ? `已选择 ${loaded.length} 个文本文件，忽略 ${rejected.length} 个非文本文件` : "", error: "" });
				} catch (error) {
					setStatus({ state: "error", message: "", error: errorText(error) });
				}
			};

			const acceptDrop = async (event) => {
				event.preventDefault();
				setDragActive(false);
				try {
					const { target: droppedTarget, entries } = await collectDroppedEntries(event.dataTransfer);
					if (entries.length === 0) {
						setStatus({ state: "error", message: "", error: "没有识别到文件；如果拖的是浏览器不允许读取的目录，请用「选择文件夹」。" });
						return;
					}
					await loadFiles(entries, droppedTarget);
				} catch (error) {
					setStatus({ state: "error", message: "", error: errorText(error) });
				}
			};

			const acceptInput = (input) => {
				const collected = collectInputFiles(input.files);
				input.value = "";
				loadFiles(collected.entries, collected.target);
			};

			const upload = () => {
				const name = personaSlug(target);
				if (!name) {
					setStatus({ state: "error", message: "", error: "请填写人设目录名（字母、数字、点、横线或中文，例如 my-persona）。" });
					return;
				}
				if (!files.length) {
					setStatus({ state: "error", message: "", error: "先选择或拖入人设文件。" });
					return;
				}
				setStatus({ state: "running", message: `正在上传 ${files.length} 个文件到虚拟机 personas/${name}…`, error: "" });
				postJson(`${API_BASE}/personas/upload`, {
					name,
					files: files.map((file) => ({ path: file.path, content: file.content })),
					overwrite: Boolean(overwrite),
					apply: Boolean(apply),
				}).then((result) => {
					const persona = result && result.persona && typeof result.persona === "object" ? result.persona : result || {};
					const mainFile = persona.mainFile ? String(persona.mainFile) : "SKILL.md";
					const applied = Boolean(result && result.applied);
					const restarted = Boolean(result && result.restarted);
					setStatus({
						state: "done",
						message: `已上传 ${files.length} 个文件到 personas/${name}（主文件 ${mainFile}）${applied ? (restarted ? "；已设为当前人设，监听已按新配置重启" : "；已设为当前人设，下次启动生效") : "；仅上传文件，未改当前人设"}`,
						error: "",
					});
					setFiles([]);
					reloadPersonas();
					if (applied && onSaved) onSaved();
				}).catch((error) => setStatus({ state: "error", message: "", error: errorText(error) }));
			};

			return React.createElement(Card, {
				title: "人设文件上传",
				hint: current && current.name ? `当前人设：${current.name}${current.file ? ` · ${current.file}` : ""}` : "把写好的角色设定直接拖进来",
				actions: [React.createElement(Button, { key: "reload", onClick: reloadPersonas }, "刷新人设列表")],
			},
				React.createElement("div", {
					style: { ...styles.dropzone, ...(dragActive ? styles.dropzoneActive : {}) },
					role: "button",
					tabIndex: 0,
					onDragOver: (event) => { event.preventDefault(); setDragActive(true); },
					onDragEnter: (event) => { event.preventDefault(); setDragActive(true); },
					onDragLeave: () => setDragActive(false),
					onDrop: acceptDrop,
					onClick: () => { if (fileInputRef.current) fileInputRef.current.click(); },
				},
					React.createElement("div", null, dragActive ? "松手即可载入文件" : "把新人设的 .md / .txt 文件，或整个文件夹拖到这里"),
					React.createElement("div", { style: styles.cardHint }, "只收文本文件（.md/.markdown/.txt/.json/.yaml/.yml/.toml/.ini/.csv），最多 200 个、合计 5 MB；文件夹会保留 references/ 这类子目录。"),
				),
				React.createElement("input", { ref: fileInputRef, type: "file", multiple: true, style: { display: "none" }, onChange: (event) => acceptInput(event.target) }),
				React.createElement("input", { ref: folderInputRef, type: "file", multiple: true, webkitdirectory: "", directory: "", style: { display: "none" }, onChange: (event) => acceptInput(event.target) }),
				React.createElement("div", { style: wiz.row },
					React.createElement(Button, { onClick: () => { if (fileInputRef.current) fileInputRef.current.click(); } }, "选择文件"),
					React.createElement(Button, { onClick: () => { if (folderInputRef.current) folderInputRef.current.click(); } }, "选择文件夹"),
					files.length > 0 ? React.createElement(Button, { onClick: () => { setFiles([]); setStatus({ state: "idle", message: "", error: "" }); } }, "清空选择") : null,
				),
				React.createElement("div", { style: { ...wiz.grid, marginTop: 8 } },
					React.createElement(SetupField, { label: "人设目录名", hint: "写到虚拟机 personas/ 下" },
						React.createElement(SetupInput, { value: target, onChange: setTarget, placeholder: "例如 my-persona", disabled: status.state === "running" })),
					React.createElement(SetupField, { label: "上传选项" },
						React.createElement("label", { style: { ...styles.cardHint, display: "inline-flex", alignItems: "center", gap: 6, marginTop: 3 } },
							React.createElement("input", { type: "checkbox", checked: overwrite, onChange: (event) => setOverwrite(event.target.checked) }),
							"覆盖同名文件"),
						React.createElement("label", { style: { ...styles.cardHint, display: "inline-flex", alignItems: "center", gap: 6, marginTop: 2 } },
							React.createElement("input", { type: "checkbox", checked: apply, onChange: (event) => setApply(event.target.checked) }),
							"上传后设为当前人设"),
					),
				),
				files.length > 0 ? React.createElement("div", { style: styles.fileList },
					files.map((file) => React.createElement("div", { key: file.path, style: styles.fileRow },
						React.createElement("span", { style: styles.truncate }, file.path),
						React.createElement("span", { style: styles.mono }, `${(file.size / 1024).toFixed(1)} KB`),
					)),
				) : null,
				React.createElement("div", { style: wiz.row },
					React.createElement(Button, { kind: "primary", onClick: upload, disabled: status.state === "running" || files.length === 0 || !personaSlug(target) }, status.state === "running" ? "上传中…" : "上传到虚拟机"),
					React.createElement("span", { style: styles.cardHint }, "只写入虚拟机 personas/ 目录；「上传后设为当前人设」会改 .env 里的 PERSONA_NAME / PERSONA_FILE。"),
				),
				status.state === "running" ? React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "brand" }, status.message)) : null,
				status.state === "done" ? React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "ok" }, status.message)) : null,
				status.state === "error" ? React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "error" }, status.error)) : null,
				known.length > 0 ? React.createElement("div", { style: { marginTop: 8 } },
					React.createElement("div", { style: styles.cardHint }, `虚拟机上的 ${known.length} 个人设：`),
					known.slice(0, 12).map((persona) => React.createElement("div", { key: persona.name, style: styles.listRow },
						React.createElement("span", { style: styles.truncate }, String(persona.name || "")),
						React.createElement("span", { style: styles.mono }, `${Array.isArray(persona.files) ? persona.files.length : 0} 个文件`),
						current && current.name === persona.name ? React.createElement("span", { style: styles.badge }, "当前") : null,
					)),
				) : null,
			);
		}

		function SettingsTab() {
			const [config, reloadConfig] = useResource(`${API_BASE}/config`, 0);
			const [chats, reloadChats] = useResource(`${API_BASE}/wechat/private-chats`, 0);
			const [groupsState, reloadGroups] = useResource(`${API_BASE}/groups`, 0);
			const [draft, setDraft] = React.useState({});
			const [cleared, setCleared] = React.useState({});
			const [advanced, setAdvanced] = React.useState(false);
			const [save, setSave] = React.useState({ state: "idle", message: "", error: "" });
			const [confirmSave, setConfirmSave] = React.useState(false);

			const snapshot = config.status === "ready" && config.data && typeof config.data === "object" ? config.data : null;
			const fields = snapshot && Array.isArray(snapshot.fields) ? snapshot.fields : [];
			const values = (snapshot && snapshot.values) || {};
			const secrets = (snapshot && snapshot.configured_secrets) || {};
			const groupOptions = groupsState.status === "ready" && Array.isArray(groupsState.data && groupsState.data.groups) ? groupsState.data.groups.filter((group) => group && String(group.group_id).endsWith("@chatroom")) : [];
			const chatOptions = chats.status === "ready" && chats.data && Array.isArray(chats.data.contacts) ? chats.data.contacts : [];

			const visible = fields.filter((field) => field && field.visible === true && field.hidden !== true);
			const advancedFields = fields.filter((field) => field && field.advanced === true && field.hidden !== true);
			// Dirty detection spans every non-hidden field, including advanced ones
			// folded away right now: hiding a section must never silently drop an edit.
			const editable = fields.filter((field) => field && field.hidden !== true);

			const edit = (env, value) => setDraft((prev) => ({ ...prev, [env]: value }));
			const toggleClear = (env, value) => setCleared((prev) => ({ ...prev, [env]: value }));

			const dirtyFields = editable.filter((field) => {
				if (!Object.prototype.hasOwnProperty.call(draft, field.env)) return false;
				const current = draft[field.env];
				const baseline = fieldBaseline(field, values);
				if (field.type === "checkbox") return Boolean(current) !== Boolean(baseline);
				return String(current ?? "") !== String(baseline ?? "");
			});
			const clearEnvs = Object.keys(cleared).filter((env) => cleared[env]);

			const saveChanges = () => {
				if (!confirmSave) {
					setConfirmSave(true);
					return;
				}
				setConfirmSave(false);
				const payload = {};
				for (const field of dirtyFields) {
					if (field.secret && String(draft[field.env] ?? "").trim() === "") continue;
					const value = field.type === "number" ? numberOrText(draft[field.env]) : draft[field.env];
					payload[field.env] = value;
				}
				if (Object.keys(payload).length === 0 && clearEnvs.length === 0) {
					setSave({ state: "done", message: "没有需要保存的改动", error: "" });
					return;
				}
				setSave({ state: "running", message: "正在保存到虚拟机 .env…", error: "" });
				postJson(`${API_BASE}/config`, { values: payload, clear_secrets: clearEnvs })
					.then((result) => {
						setDraft({});
						setCleared({});
						setSave({ state: "done", message: result && result.restarted ? "已保存，监听已按新配置重启" : "已保存；当前未运行，下次启动生效", error: "" });
						reloadConfig();
						reloadChats();
					})
					.catch((error) => setSave({ state: "error", message: "", error: errorText(error) }));
			};

			if (config.status === "loading") return React.createElement(Empty, null, "正在读取虚拟机配置…");
			if (config.status === "error") {
				return React.createElement(Card, { title: "设置" },
					React.createElement(Banner, { tone: "error" }, `配置读取失败：${config.error}`),
					React.createElement("div", { style: { marginTop: 10 } }, React.createElement(Button, { onClick: reloadConfig }, "重试")),
				);
			}

			const renderField = (field) => {
				const env = String(field.env);
				const value = fieldCurrent(field, values, draft);
				if (env === "WECHAT_GROUP_NAMES") {
					const selected = splitList(value);
					const names = groupOptions.map((group) => String(group.group_name || "")).filter(Boolean);
					const options = Array.from(new Set([...names, ...selected]));
					return React.createElement("div", { key: env, style: styles.fieldRow },
						React.createElement("div", { style: styles.fieldTop }, React.createElement("span", { style: styles.fieldLabel }, String(field.label || env), React.createElement("div", { style: styles.fieldTip }, String(field.description || "")))),
						React.createElement("div", { style: styles.chips }, options.map((name) => React.createElement("button", {
							key: name,
							type: "button",
							style: { ...styles.chip, ...(selected.includes(name) ? styles.chipActive : {}) },
							onClick: () => {
								const next = selected.includes(name) ? selected.filter((item) => item !== name) : [...selected, name];
								edit(env, next.join(","));
							},
						}, name))),
						React.createElement("input", { style: { ...styles.input, marginTop: 6 }, value: String(value ?? ""), onChange: (event) => edit(env, event.target.value), placeholder: "也可以手动输入，逗号分隔" }),
					);
				}
				if (env === "WECHAT_PRIVATE_CHAT_NAMES") {
					const selected = splitList(value);
					const selectedSet = new Set(selected);
					const options = chatOptions.map((chat) => ({ id: String(chat.chat_id || ""), name: String(chat.name || chat.chat_id || "") })).filter((chat) => chat.id);
					return React.createElement("div", { key: env, style: styles.fieldRow },
						React.createElement("div", { style: styles.fieldTop }, React.createElement("span", { style: styles.fieldLabel }, String(field.label || env), React.createElement("div", { style: styles.fieldTip }, String(field.description || "")))),
						chats.status === "loading" ? React.createElement(Empty, null, "正在读取联系人…") : null,
						React.createElement("div", { style: styles.chips }, options.map((chat) => {
							const active = selectedSet.has(chat.id) || selectedSet.has(chat.name);
							return React.createElement("button", {
								key: chat.id,
								type: "button",
								style: { ...styles.chip, ...(active ? styles.chipActive : {}) },
								onClick: () => {
									const next = active ? selected.filter((item) => item !== chat.id && item !== chat.name) : [...selected, chat.id];
									edit(env, next.join(","));
								},
							}, chat.name);
						})),
						React.createElement("div", { style: { marginTop: 6, display: "flex", gap: 6 } },
							React.createElement("input", { style: { ...styles.input }, value: String(value ?? ""), onChange: (event) => edit(env, event.target.value), placeholder: "也可以粘贴 wxid，逗号分隔" }),
							React.createElement(Button, { onClick: reloadChats }, "重取联系人"),
						),
					);
				}
				return React.createElement(Field, {
					key: env,
					field,
					value,
					configured: Boolean(secrets[env]),
					cleared: Boolean(cleared[env]),
					onChange: (next) => edit(env, next),
					onClear: (next) => toggleClear(env, next),
				});
			};

			const groupsByTitle = [];
			for (const field of visible) {
				const title = String(field.group || field.category || "常用");
				let section = groupsByTitle.find((item) => item.title === title);
				if (!section) {
					section = { title, fields: [] };
					groupsByTitle.push(section);
				}
				section.fields.push(field);
			}
			const advancedByTitle = [];
			for (const field of advancedFields) {
				const title = String(field.category || "高级");
				let section = advancedByTitle.find((item) => item.title === title);
				if (!section) {
					section = { title, fields: [] };
					advancedByTitle.push(section);
				}
				section.fields.push(field);
			}
			// 模型 Key 是新手最先要填的一项，固定在常用设置的第一组，省得往下翻。
			const pinnedGroups = ["模型"];
			groupsByTitle.sort((left, right) => {
				const leftIndex = pinnedGroups.indexOf(left.title);
				const rightIndex = pinnedGroups.indexOf(right.title);
				const leftRank = leftIndex >= 0 ? leftIndex : pinnedGroups.length;
				const rightRank = rightIndex >= 0 ? rightIndex : pinnedGroups.length;
				return leftRank - rightRank;
			});

			return React.createElement("div", { style: styles.section },
				React.createElement(Card, {
					title: "设置",
					hint: snapshot && snapshot.path ? `写入 ${snapshot.path}` : "写入虚拟机 .env",
					actions: [
						React.createElement(Button, { key: "adv", onClick: () => setAdvanced((value) => !value) }, advanced ? "隐藏高级" : "显示高级"),
						React.createElement(Button, { key: "save", kind: dirtyFields.length > 0 || clearEnvs.length > 0 ? "primary" : undefined, onClick: saveChanges, disabled: save.state === "running" }, confirmSave ? "确认保存（会重载）" : `保存${dirtyFields.length > 0 || clearEnvs.length > 0 ? ` (${dirtyFields.length + clearEnvs.length})` : ""}`),
						React.createElement(Button, { key: "reload", onClick: () => { setDraft({}); setCleared({}); setConfirmSave(false); setSave({ state: "idle", message: "", error: "" }); reloadConfig(); reloadChats(); reloadGroups(); } }, "重置"),
					],
				},
					confirmSave ? React.createElement(Banner, { tone: "warn" }, "保存会写入虚拟机 .env；如果 Agent 正在运行，会按新配置重启自动回复线程。再点一次「确认保存」继续。") : null,
					save.state === "running" ? React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "brand" }, save.message)) : null,
					save.state === "done" ? React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "ok" }, save.message)) : null,
					save.state === "error" ? React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "error" }, `保存失败：${save.error}`)) : null,
					React.createElement("div", { style: { ...styles.cardHint, marginTop: 8 } }, `共 ${fields.length} 项，常用 ${visible.length} 项${advanced ? `，高级 ${advancedFields.length} 项` : "（高级已折叠）"}；修改项 ${dirtyFields.length}。`),
					React.createElement("div", { style: { ...styles.cardHint, marginTop: 4 } }, "模型 Key 在下方「模型」组（已置顶，填好后点保存）；人设文件可以直接拖到「人设文件上传」。"),
				),
				React.createElement(PersonaUploadCard, { key: "persona-upload", onSaved: () => { reloadConfig(); reloadChats(); reloadGroups(); } }),

				...groupsByTitle.map((section) =>
					React.createElement("div", { key: section.title, style: styles.groupCard },
						React.createElement("div", { style: styles.groupHead }, section.title),
						section.fields.map(renderField),
					)),

				advanced ? React.createElement("div", null,
					React.createElement("div", { style: { ...styles.cardTitle, margin: "4px 0 8px" } }, "高级设置"),
					advancedByTitle.map((section) =>
						React.createElement("div", { key: `adv-${section.title}`, style: styles.groupCard },
							React.createElement("div", { style: styles.groupHead }, section.title),
							section.fields.map(renderField),
						)),
				) : null,
			);
		}

		// ------------------------------------------------------------- 部署 tab

		function SetupField({ label, hint, children }) {
			return React.createElement("label", { style: wiz.field },
				React.createElement("span", { style: wiz.label }, label, hint ? React.createElement("span", { style: wiz.hintSmall }, ` ${hint}`) : null),
				children);
		}

		function SetupInput({ value, onChange, placeholder, type, disabled, style, onKeyDown }) {
			return React.createElement("input", {
				style: { ...wiz.input, ...(style || {}) },
				value: value === undefined || value === null ? "" : String(value),
				placeholder: placeholder || "",
				type: type || "text",
				disabled: Boolean(disabled),
				onChange: (event) => onChange(event.target.value),
				onKeyDown: onKeyDown || undefined,
			});
		}

		function SetupSelect({ value, onChange, options, style }) {
			return React.createElement("select", { style: { ...wiz.input, ...(style || {}) }, value, onChange: (event) => onChange(event.target.value) },
				options.map((option) => React.createElement("option", { key: option.value, value: option.value }, option.label)));
		}

		function SetupCheck({ ok, label, detail }) {
			return React.createElement("div", { style: wiz.checkRow },
				React.createElement("span", { style: { ...wiz.checkMark, color: ok ? C.ok : C.muted } }, ok ? "✓" : "×"),
				React.createElement("span", { style: { flex: 1, minWidth: 0, wordBreak: "break-word" } }, label,
					detail ? React.createElement("span", { style: wiz.hintSmall }, ` ${detail}`) : null));
		}

		function SetupStep({ index, title, hint, actions, children, tone }) {
			const border = tone === "active" ? wiz.stepActive : tone === "done" ? wiz.stepDone : {};
			return React.createElement("section", { style: { ...styles.card2, ...border } },
				React.createElement("div", { style: styles.cardHead },
					React.createElement("span", { style: wiz.stepIndex }, String(index)),
					React.createElement("span", { style: styles.cardTitle }, title),
					hint ? React.createElement("span", { style: styles.cardHint }, hint) : null,
					actions ? React.createElement("span", { style: { marginLeft: "auto", display: "inline-flex", gap: 6, flexWrap: "wrap" } }, actions) : null),
				React.createElement("div", { style: { marginTop: 8 } }, children));
		}

		const SETUP_FORM_DEFAULT = {
			host: "",
			port: 22,
			username: "wx",
			authType: "password",
			password: "",
			privateKeyPath: "~/.ssh/id_ed25519",
			passphrase: "",
			projectDir: "~/wechat-agent-linux",
			consolePort: 8765,
		};

		const DEPLOY_ENV_DEFAULT = {
			LLM_BASE_URL: "",
			LLM_API_KEY: "",
			LLM_MODEL: "",
			WECHAT_GROUP_NAMES: "",
			WECHAT_SELF_NAME: "小鱼",
		};

		function DeployTab({ setup, reloadSetup, reloadHealth, health, onOpenSettings, onOpenOverview }) {
			const data = setup.status === "ready" && setup.data && typeof setup.data === "object" ? setup.data : null;
			const connection = data ? data.connection : null;
			const probe = data ? data.probe : null;
			const job = data ? data.job : null;
			const tunnel = data ? data.tunnel : null;
			const assets = data ? data.assets : null;
			const configured = Boolean(data && data.configured);
			const busy = Boolean(job && job.status === "running");
			const jobRunning = busy;
			const healthData = health && health.status === "ready" ? health.data : null;
			// The plugin may already be connected through its own settings
			// (`remote_ssh` / `remote_url`). Report that instead of asking for the
			// same VM again; the takeover button only prefills the form.
			const external = data && data.external && typeof data.external === "object" ? data.external : null;
			const externalSsh = Boolean(external && external.kind === "remote_ssh" && external.host && external.username);
			const externalReachable = Boolean(!configured && healthData && healthData.reachable);
			const externalConnected = Boolean(externalReachable && externalSsh);
			const externalRemoteUrl = Boolean(externalReachable && external && external.kind === "remote_url");
			const externalTunnelMode = healthData && healthData.tunnel ? healthData.tunnel.mode : "";
			const externalTunnelLabel = externalTunnelMode === "running" ? "插件设置的 SSH 隧道已连接" : externalTunnelMode === "external" ? "复用已有的 SSH 隧道" : externalTunnelMode === "starting" ? "SSH 隧道连接中" : "SSH 隧道未连接";

			const [editing, setEditing] = React.useState(!configured);
			const [takeover, setTakeover] = React.useState(false);
			const [form, setForm] = React.useState(SETUP_FORM_DEFAULT);
			const [connectState, setConnectState] = React.useState({ state: "idle", message: "", error: "" });
			const [actionState, setActionState] = React.useState({ state: "idle", message: "", error: "" });
			const [advanced, setAdvanced] = React.useState(false);
			const [pipIndex, setPipIndex] = React.useState("https://pypi.tuna.tsinghua.edu.cn/simple");
			const [sudoPassword, setSudoPassword] = React.useState("");
			const [wechatDebPath, setWechatDebPath] = React.useState("");
			const [env, setEnv] = React.useState(DEPLOY_ENV_DEFAULT);
			const [confirmWechat, setConfirmWechat] = React.useState(false);
			const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);
			const [shot, setShot] = React.useState({ state: "idle", image: "", error: "" });
			const [showConnectHelp, setShowConnectHelp] = React.useState(false);
			const [beginnerCode, setBeginnerCode] = React.useState("");
			const [beginnerNotice, setBeginnerNotice] = React.useState({ tone: "", text: "" });
			const [beginnerCopied, setBeginnerCopied] = React.useState(false);
			const [manualMode, setManualMode] = React.useState(false);
			const [showConnectModal, setShowConnectModal] = React.useState(false);
			const logRef = React.useRef(null);
			const modalRef = React.useRef(null);

			const openConnectModal = (manual) => {
				setShowConnectModal(true);
				setManualMode(Boolean(manual));
				setConnectState({ state: "idle", message: "", error: "" });
			};
			const cancelConnectModal = () => {
				if (connectState.state === "running") return;
				setShowConnectModal(false);
				setConnectState({ state: "idle", message: "", error: "" });
				if (configured || takeover) {
					setTakeover(false);
					setEditing(false);
				}
			};

			// 弹窗打开时锁住页面滚动、把焦点移进弹窗，关闭后焦点回到原按钮。
			React.useEffect(() => {
				if (!showConnectModal) return undefined;
				const previousOverflow = document.body.style.overflow;
				const previousFocus = document.activeElement;
				document.body.style.overflow = "hidden";
				const focusTimer = setTimeout(() => {
					if (modalRef.current) modalRef.current.focus();
				}, 0);
				return () => {
					clearTimeout(focusTimer);
					document.body.style.overflow = previousOverflow;
					if (previousFocus && typeof previousFocus.focus === "function") previousFocus.focus();
				};
			}, [showConnectModal]);

			// Esc 关闭 + Tab 焦点循环，避免键盘焦点跑到遮罩后的页面上。
			React.useEffect(() => {
				if (!showConnectModal) return undefined;
				const onKeyDown = (event) => {
					if (event.key === "Escape") {
						cancelConnectModal();
						return;
					}
					if (event.key !== "Tab" || !modalRef.current) return;
					const focusable = Array.from(modalRef.current.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])"));
					if (!focusable.length) {
						event.preventDefault();
						modalRef.current.focus();
						return;
					}
					const first = focusable[0];
					const last = focusable[focusable.length - 1];
					if (event.shiftKey && (document.activeElement === first || document.activeElement === modalRef.current)) {
						event.preventDefault();
						last.focus();
					} else if (!event.shiftKey && document.activeElement === last) {
						event.preventDefault();
						first.focus();
					}
				};
				document.addEventListener("keydown", onKeyDown);
				return () => document.removeEventListener("keydown", onKeyDown);
			}, [showConnectModal, connectState.state, configured, takeover]);

			// Settings already own the connection: show the connected summary, not
			// the "fill the form" state. Clicking 接管 explicitly brings it back.
			React.useEffect(() => {
				if (!configured && externalConnected && !takeover) setEditing(false);
			}, [configured, externalConnected, takeover]);

			// 已保存的连接回填表单（密码不回显，需要重新输入才能“重新连接”）。
			React.useEffect(() => {
				if (!connection) return;
				setForm((prev) => ({
					...prev,
					host: connection.host,
					port: connection.port,
					username: connection.username,
					authType: connection.authType,
					projectDir: connection.projectDir,
					consolePort: connection.consolePort,
					password: "",
					passphrase: "",
				}));
				setEditing(false);
			}, [configured]);

			const takeOver = () => {
				setForm((prev) => ({
					...prev,
					host: external && external.host ? external.host : prev.host,
					port: external && external.port ? external.port : prev.port,
					username: external && external.username ? external.username : prev.username,
					authType: "key",
					password: "",
					privateKeyPath: "~/.ssh/id_ed25519",
					passphrase: "",
					consolePort: external && external.consolePort ? external.consolePort : prev.consolePort,
				}));
				setTakeover(true);
				setEditing(true);
				setConnectState({ state: "idle", message: "", error: "" });
				openConnectModal(true);
			};

			const takeOverRemoteUrl = () => {
				setForm((prev) => ({
					...prev,
					host: external && external.host ? external.host : prev.host,
					authType: "password",
					consolePort: external && external.consolePort ? external.consolePort : prev.consolePort,
				}));
				setTakeover(true);
				setEditing(true);
				setConnectState({ state: "idle", message: "", error: "" });
				openConnectModal(true);
			};

			React.useEffect(() => {
				if (!jobRunning) return undefined;
				const timer = setInterval(() => reloadSetup(), 1500);
				return () => clearInterval(timer);
			}, [jobRunning]);

			const previousJobStatus = React.useRef(null);
			React.useEffect(() => {
				const status = job ? job.status : null;
				if (previousJobStatus.current === "running" && status && status !== "running") {
					reloadSetup();
					if (reloadHealth) reloadHealth();
				}
				previousJobStatus.current = status;
			}, [job && job.status]);

			React.useEffect(() => {
				if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
			}, [job && job.log ? job.log.length : 0]);

			const updateForm = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
			const updateEnv = (key) => (value) => setEnv((prev) => ({ ...prev, [key]: value }));

			const copyOnboardCommand = async () => {
				setBeginnerCopied(false);
				const copied = await copyTextToClipboard(ONBOARD_COMMAND);
				setBeginnerCopied(copied);
			};

			const onBeginnerCodeChange = (value) => {
				setBeginnerCode(value);
				const parsed = parseOnboardCode(value);
				if (parsed) {
					setForm((prev) => ({
						...prev,
						host: parsed.host,
						port: parsed.port,
						username: parsed.username,
						authType: "password",
					}));
					setBeginnerNotice({ tone: "ok", text: `已识别 ${parsed.username}@${parsed.host}:${parsed.port}，再输入密码即可连接。` });
					return;
				}
				setBeginnerNotice(value.trim()
					? { tone: "warn", text: "没识别到连接码，请粘贴以 WECHAT-VM-CODE: 开头的那一行。" }
					: { tone: "", text: "" });
			};

			const connect = () => {
				const payload = {
					host: String(form.host || "").trim(),
					port: Number(form.port) || 22,
					username: String(form.username || "").trim(),
					authType: form.authType,
					password: form.authType === "password" ? form.password : "",
					privateKeyPath: form.privateKeyPath,
					passphrase: form.authType === "key" ? form.passphrase : "",
					projectDir: form.projectDir,
					consolePort: Number(form.consolePort) || 8765,
				};
				if (!payload.host || !payload.username) {
					setConnectState({ state: "error", message: "", error: manualMode ? "请填写虚拟机 IP 地址和登录用户名" : "请先粘贴虚拟机终端显示的连接码（WECHAT-VM-CODE:...）；找不到就点下方「手动填写」。" });
					return;
				}
				setConnectState({ state: "running", message: "正在连接虚拟机并检测环境（约 10 秒）…", error: "" });
				postJson(`${SETUP_BASE}/connect`, payload)
					.then((result) => {
						if (result && result.ok) {
							setConnectState({ state: "done", message: "连接成功，虚拟机环境已检测", error: "" });
							setActionState({ state: "idle", message: "", error: "" });
							setTakeover(false);
							setEditing(false);
							setShowConnectModal(false);
							reloadSetup();
							if (reloadHealth) reloadHealth();
						} else {
							setConnectState({ state: "error", message: "", error: (result && result.error) || "连接失败" });
						}
					})
					.catch((error) => setConnectState({ state: "error", message: "", error: errorText(error) }));
			};

			const disconnect = () => {
				if (!confirmDisconnect) {
					setConfirmDisconnect(true);
					return;
				}
				setConfirmDisconnect(false);
				postJson(`${SETUP_BASE}/disconnect`, {})
					.then(() => {
						setConnectState({ state: "idle", message: "", error: "" });
						setShot({ state: "idle", image: "", error: "" });
						setTakeover(false);
						setEditing(true);
						reloadSetup();
						if (reloadHealth) reloadHealth();
					})
					.catch((error) => setConnectState({ state: "error", message: "", error: errorText(error) }));
			};

			const refreshProbe = () => {
				setActionState({ state: "running", message: "正在重新检测虚拟机环境…", error: "" });
				postJson(`${SETUP_BASE}/probe`, {})
					.then((result) => {
						if (result && result.ok) setActionState({ state: "done", message: "环境检测已更新", error: "" });
						else setActionState({ state: "error", message: "", error: (result && result.error) || "检测失败" });
						reloadSetup();
						if (reloadHealth) reloadHealth();
					})
					.catch((error) => setActionState({ state: "error", message: "", error: errorText(error) }));
			};

			const runAction = (action, extra) => {
				if (busy) return;
				const payload = { action, ...(extra || {}) };
				if (action === "deploy") {
					payload.pipIndex = pipIndex.trim();
					payload.sudoPassword = sudoPassword;
					payload.wechatDebPath = wechatDebPath.trim();
					payload.env = { ...env };
				}
				setActionState({ state: "running", message: "任务已开始，日志会在下方实时滚动…", error: "" });
				postJson(`${SETUP_BASE}/run`, payload)
					.then((result) => {
						if (result && result.ok) {
							setConfirmWechat(false);
							reloadSetup();
						} else {
							setActionState({ state: "error", message: "", error: (result && result.error) || "任务没有启动" });
						}
					})
					.catch((error) => setActionState({ state: "error", message: "", error: errorText(error) }));
			};

			const loadShot = () => {
				setShot({ state: "loading", image: "", error: "" });
				postJson(`${SETUP_BASE}/screenshot`, {})
					.then((result) => {
						if (result && result.ok && result.image) setShot({ state: "ready", image: result.image, error: "" });
						else setShot({ state: "error", image: "", error: (result && result.error) || "截图失败" });
					})
					.catch((error) => setShot({ state: "error", image: "", error: errorText(error) }));
			};

			const startWechat = () => {
				if (!confirmWechat) {
					setConfirmWechat(true);
					return;
				}
				setConfirmWechat(false);
				runAction("start-wechat", {});
			};

			if (setup.status === "loading") return React.createElement(Empty, null, "正在读取虚拟机连接状态…");
			if (setup.status === "error") {
				return React.createElement("div", { style: styles.section },
					React.createElement(Banner, { tone: "error" }, `连接状态读取失败：${setup.error}`),
					React.createElement("div", { style: { marginTop: 10 } }, React.createElement(Button, { onClick: reloadSetup }, "重试")),
				);
			}

			const tunnelMode = tunnel && tunnel.mode;
			const tunnelLabel = tunnelMode === "running" ? "SSH 隧道已连接" : tunnelMode === "external" ? "复用已有的 SSH 隧道" : tunnelMode === "starting" ? "SSH 隧道连接中" : "SSH 隧道未连接";
			const tunnelTone = tunnelMode === "running" || tunnelMode === "external" ? "ok" : tunnelMode === "starting" ? "warn" : "muted";
			const probeReady = Boolean(probe && probe.ok);
			const deployed = Boolean(probe && probe.project && probe.project.venv);
			const wechatRunning = Boolean(probe && probe.wechat && probe.wechat.running);
			const wechatInstalled = Boolean(probe && probe.wechat && probe.wechat.installed);
			const consoleOpen = Boolean((probe && probe.console && probe.console.open) || (healthData && healthData.reachable));
			const sessionReady = Boolean(probe && probe.deps && probe.deps.sessionFile);
			const aptReady = Boolean(probe && probe.deps && probe.deps.aptReady);
			const sudoPasswordless = Boolean(probe && probe.sudo && probe.sudo.passwordless);
			const deployLabel = deployed ? "更新代码并重启控制台" : "一键部署到虚拟机";

			const connectBanner = (state) => {
				if (state.state === "running") return React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "brand" }, state.message));
				if (state.state === "done" && state.message) return React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "ok" }, state.message));
				if (state.state === "error") return React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "error" }, `失败：${state.error}`));
				return null;
			};

			// 1. 连接虚拟机 ----------------------------------------------------
			const selfConnected = configured && !editing;
			// 插件设置里的 remote_ssh 已经连上时，第 1 步直接显示已连接摘要，
			// 不再让用户重复填一遍；只有点「用部署页接管」才回到表单。
			const externalDone = externalConnected && !editing;
			const externalUrlDone = externalRemoteUrl && !editing;
			const step1Hint = selfConnected
				? `${connection.username}@${connection.host}`
				: externalDone
					? `${external.username}@${external.host}（来自插件设置）`
					: externalUrlDone
						? `${external.target}（来自插件设置）`
						: "点「一键连接」打开操作页；复制命令到虚拟机运行，再把连接码粘回来"
			const step1Actions = selfConnected
				? [
					React.createElement(Button, { key: "probe", onClick: refreshProbe, disabled: busy }, "刷新检测"),
					React.createElement(Button, { key: "edit", onClick: () => { setEditing(true); openConnectModal(true); }, disabled: busy }, "重新连接"),
					React.createElement(Button, { key: "disconnect", kind: "danger", onClick: disconnect, disabled: busy }, confirmDisconnect ? "确认断开" : "断开"),
				]
				: externalDone
					? [
						React.createElement(Button, { key: "takeover", kind: "primary", onClick: takeOver, disabled: busy }, "用部署页接管"),
						React.createElement(Button, { key: "reload", onClick: () => { reloadSetup(); if (reloadHealth) reloadHealth(); }, disabled: busy }, "刷新状态"),
					]
					: externalUrlDone
						? [
							React.createElement(Button, { key: "takeover", kind: "primary", onClick: takeOverRemoteUrl, disabled: busy }, "填写 SSH 接管"),
							React.createElement(Button, { key: "reload", onClick: () => { reloadSetup(); if (reloadHealth) reloadHealth(); }, disabled: busy }, "刷新状态"),
						]
						: null;
			// 连接前的前置条件提示：非技术用户常常不知道 VM 的 IP、用户名、
			// 密码和 SSH 服务从哪里拿，这里直接给出在虚拟机里要运行的命令。
			// 未配置时默认展开；配置过或用户点过“收起”就折叠。
			const connectCode = (text) => React.createElement("code", { style: { ...wiz.mono, background: C.hover, borderRadius: 4, padding: "0 4px" } }, text);
			const connectHelpRow = (label, ...content) => React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "baseline", marginTop: 5 } },
				React.createElement("span", { style: { flex: "0 0 92px", color: C.muted, fontSize: 10.5 } }, label),
				React.createElement("span", { style: { flex: 1, minWidth: 0, wordBreak: "break-word" } }, ...content));
			const connectHelp = React.createElement("div", { style: { marginBottom: 10, border: `1px solid ${C.divider}`, borderRadius: 10, padding: "8px 12px", background: "rgba(127,127,127,0.05)" } },
				React.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: 8, cursor: "pointer" }, onClick: () => setShowConnectHelp((value) => !value) },
					React.createElement("span", { style: { fontWeight: 650, fontSize: 11.5 } }, "连不上？按这 4 项检查"),
					React.createElement("span", { style: { color: C.muted, fontSize: 10.5, marginLeft: "auto" } }, showConnectHelp ? "收起" : "展开")),
				showConnectHelp ? React.createElement("div", { style: { marginTop: 8, color: C.secondary, fontSize: 11, lineHeight: 1.65 } },
					connectHelpRow("① 虚拟机 IP", "在虚拟机里打开终端运行 ", connectCode("hostname -I"), "，取第一个地址（形如 192.168.1.50）；Windows 这边不要填 127.0.0.1。"),
					connectHelpRow("② SSH 服务", "Ubuntu 桌面版默认可能没装。在虚拟机里运行 ", connectCode("sudo apt install -y openssh-server && sudo systemctl enable --now ssh"), "；再用 ", connectCode("systemctl status ssh"), " 确认是 active (running)。如果之前关过密码登录，要在 sshd_config 里设 PasswordAuthentication yes 并重启 ssh，或在页面改选 SSH 私钥；开了 ufw 还要放行 22 端口。"),
					connectHelpRow("③ 用户名和密码", "用户名用 ", connectCode("whoami"), " 查；密码就是开机登录密码。部署时验证 ", connectCode("sudo"), " 也要用它，两边一致时下面的「sudo 密码」可以留空。"),
					connectHelpRow("④ 从 Windows 先试连", "按 Win+R 输入 ", connectCode("cmd"), "，运行 ", connectCode("ssh 用户名@虚拟机IP"), "；能输入密码并登录就说明前置条件齐了。插件和虚拟机在同一台 Windows 上时，VMware NAT 默认就能连；要让别的电脑连，再改桥接或做 22 端口转发。"),
					React.createElement("div", { style: { marginTop: 6, color: C.muted, fontSize: 10.5 } }, "这些信息只用于连接和部署，填错只会连接失败，不会修改虚拟机。")
				) : null);
			const step1 = React.createElement(SetupStep, {
				index: 1,
				title: "连接虚拟机",
				hint: step1Hint,
				tone: selfConnected || externalDone || externalUrlDone ? "done" : "active",
				actions: step1Actions,
			},
				selfConnected
					? React.createElement("div", null,
						React.createElement(KV, { label: "地址" }, `${connection.username}@${connection.host}:${connection.port}`),
						React.createElement(KV, { label: "认证" }, connection.authType === "key" ? `SSH 私钥${connection.hasPassphrase ? "（带口令）" : ""}` : "SSH 密码"),
						React.createElement(KV, { label: "SSH 隧道" }, React.createElement("span", null, React.createElement(Pill, { tone: tunnelTone }, tunnelLabel), tunnel && tunnel.error ? React.createElement("span", { style: { color: C.error } }, ` ${tunnel.error}`) : null)),
						React.createElement(KV, { label: "项目目录" }, connection.projectDir),
						React.createElement(KV, { label: "控制台端口" }, String(connection.consolePort)),
						connectBanner(connectState),
						confirmDisconnect ? React.createElement("div", { style: wiz.hintSmall }, "再点一次「确认断开」会删除本机保存的虚拟机密码；虚拟机上的程序不受影响。") : null,
					)
					: externalDone
						? React.createElement("div", null,
							React.createElement(KV, { label: "地址" }, `${external.username}@${external.host}:${external.port}`),
							React.createElement(KV, { label: "连接来源" }, "插件设置里的 remote_ssh（已经连上，不用再填一次）"),
							React.createElement(KV, { label: "SSH 隧道" }, React.createElement(Pill, { tone: "ok" }, externalTunnelLabel)),
							React.createElement(KV, { label: "控制台" }, healthData && healthData.console && healthData.console.phase ? `在线 · ${healthData.console.phase}` : "在线"),
							React.createElement("div", { style: { marginTop: 8 } },
								React.createElement(Banner, { tone: "ok" }, "已经连上这台虚拟机：插件设置里的 SSH 通道正在工作，控制台在线。要在这里做环境检测、部署或更新时，点「用部署页接管」——默认沿用本机 SSH 密钥，不用重新输密码。")),
							connectBanner(connectState),
						)
						: externalUrlDone
							? React.createElement("div", null,
								React.createElement(KV, { label: "地址" }, external.target),
								React.createElement(KV, { label: "连接来源" }, "插件设置里的 remote_url 直连（已经连上，不用再填 SSH）"),
								React.createElement(KV, { label: "控制台" }, healthData && healthData.console && healthData.console.phase ? `在线 · ${healthData.console.phase}` : "在线"),
								React.createElement("div", { style: { marginTop: 8 } },
									React.createElement(Banner, { tone: "ok" }, "已经通过插件设置直连这台虚拟机的控制台。部署、更新和环境检测要通过 SSH 进行：点「填写 SSH 接管」，地址和端口已经按当前连接填好，补上用户名和密码即可。")),
								connectBanner(connectState),
							)
							: React.createElement("div", { style: { border: `1px solid ${C.cardBorder}`, borderRadius: "var(--dsw-radius-lg, 12px)", background: C.card, padding: "14px 16px" } },
								React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" } },
									React.createElement("div", { style: { flex: 1, minWidth: 200 } },
										React.createElement("div", { style: { fontSize: 12.5, fontWeight: 650 } }, configured ? "重新连接虚拟机" : "连接虚拟机"),
										React.createElement("div", { style: { marginTop: 3, color: C.muted, fontSize: 11, lineHeight: 1.6 } }, takeover && externalSsh ? "已按插件设置预填地址和密钥；点「一键连接」在操作页确认接管。" : "点「一键连接」打开操作页：复制一行命令到虚拟机运行，再把连接码粘回来。")),
									React.createElement(Button, { kind: "primary", onClick: () => openConnectModal(Boolean(configured || takeover)), disabled: busy }, configured ? "重新连接…" : "一键连接…")),
								React.createElement("div", { style: { display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 } },
									React.createElement("span", { style: { color: C.brand, fontSize: 10.5, cursor: "pointer" }, onClick: () => openConnectModal(true) }, "手动填写 IP / 端口 / 用户名"),
									React.createElement("span", { style: { color: C.muted, fontSize: 10.5, cursor: "pointer" }, onClick: () => { setManualMode(false); setShowConnectHelp(true); setShowConnectModal(true); } }, "连不上？展开排查说明"),
									configured || takeover
										? React.createElement("span", { style: { color: C.muted, fontSize: 10.5, cursor: "pointer" }, onClick: () => { setTakeover(false); setEditing(false); setConnectState({ state: "idle", message: "", error: "" }); } }, "取消重新连接")
										: React.createElement("span", { style: { color: C.muted, fontSize: 10.5, cursor: "pointer" }, onClick: () => openConnectModal(false) }, "第一次用？看 VMware / Ubuntu 安装教程")),
								connectBanner(connectState),
							),
			);

			// 2. 环境检测 ------------------------------------------------------
			const checkRows = [];
			if (probe) {
				const system = probe.system || {};
				const projectInfo = probe.project || {};
				const wechatInfo = probe.wechat || {};
				const consoleInfo = probe.console || {};
				checkRows.push(React.createElement(SetupCheck, {
					key: "system",
					ok: Boolean(system.python && system.python !== "none"),
					label: `${system.os || "未知系统"} · ${system.arch || "?"} · Python ${system.python || "未安装"}`,
					detail: [system.memoryMb ? `${Math.round(system.memoryMb / 1024 * 10) / 10} GB 内存` : "", system.diskFreeMb ? `${Math.round(system.diskFreeMb / 1024)} GB 可用磁盘` : ""].filter(Boolean).join(" · "),
				}));
				checkRows.push(React.createElement(SetupCheck, {
					key: "project",
					ok: Boolean(projectInfo.venv),
					label: projectInfo.venv ? "项目已部署，Python 环境就绪" : projectInfo.manager ? "项目文件在，但 Python 环境还没装" : "项目还没部署",
					detail: projectInfo.path || "",
				}));
				checkRows.push(React.createElement(SetupCheck, {
					key: "wechat",
					ok: Boolean(wechatInfo.installed && wechatInfo.running),
					label: wechatInfo.installed ? (wechatInfo.running ? "微信已安装并正在运行" : "微信已安装，但还没运行") : "微信还没安装",
					detail: wechatInfo.dataDir || "",
				}));
				checkRows.push(React.createElement(SetupCheck, {
					key: "console",
					ok: Boolean(consoleInfo.open),
					label: consoleInfo.open ? "控制台在线" : "控制台还没启动",
					detail: `127.0.0.1:${consoleInfo.port || connection.consolePort}${consoleInfo.phase ? ` · ${consoleInfo.phase}` : ""}`,
				}));
				checkRows.push(React.createElement(SetupCheck, {
					key: "deps",
					ok: aptReady,
					label: aptReady ? "系统依赖已安装" : "系统依赖需要安装（部署时自动处理）",
					detail: sudoPasswordless ? "sudo 免密" : "sudo 需要密码",
				}));
				if (probe.error) checkRows.push(React.createElement(Banner, { key: "probe-error", tone: "error" }, `检测出错：${probe.error}`));
			}
			// 插件设置已经连上时，第 2～4 步不再说“先完成第 1 步”，而是按各自
			// 用途说明“部署页还没接管 SSH”，并指向第 1 步的接管按钮。
			const gateFor = (step) => {
				if (takeover && (externalConnected || externalRemoteUrl)) {
					const tail = step === "deploy"
						? "连上后这里会上传源码、安装或更新，且不会覆盖虚拟机的 .env 和数据库。"
						: step === "wechat"
							? "连上后这里可以检测微信、启动图形界面并截图扫码。"
							: "连上后这里会自动做完整的系统、Python、微信、控制台和 sudo 检测。";
					return `连接信息已经按插件设置预填好了：确认后点「一键连接」，连上后控制台和后续部署就交给部署页管理。${tail}`;
				}
				if (externalConnected) {
					if (step === "deploy") return "插件已经连上这台虚拟机（见第 1 步），不用再连接。部署或更新要走部署页自己的 SSH：点第 1 步「用部署页接管」后，这里会上传源码、安装或更新，且不会覆盖虚拟机的 .env 和数据库。";
					if (step === "wechat") return "插件已经连上这台虚拟机（见第 1 步），不用再连接。微信截图、启动微信和阶段任务要在接管后使用：点第 1 步「用部署页接管」，默认沿用本机 SSH 密钥。";
					return "插件已经连上这台虚拟机（见第 1 步），不用再连接。完整环境检测走部署页自己的 SSH：点第 1 步「用部署页接管」，默认沿用本机 SSH 密钥。";
				}
				if (externalRemoteUrl) {
					if (step === "deploy") return "插件已经直连这台虚拟机的控制台。部署或更新要通过 SSH 进行：点第 1 步「填写 SSH 接管」，补上登录信息即可。";
					if (step === "wechat") return "插件已经直连这台虚拟机的控制台。微信截图和阶段任务要通过 SSH 进行：点第 1 步「填写 SSH 接管」补上登录信息即可。";
					return "插件已经直连这台虚拟机的控制台。部署页的完整检测需要 SSH：点第 1 步「填写 SSH 接管」补上登录信息即可。";
				}
				return "先完成第 1 步连接虚拟机。";
			};
			const step2 = React.createElement(SetupStep, {
				index: 2,
				title: "环境检测",
				hint: probe ? `最近检测 ${fmtTime(probe.at)}` : configured ? "连接后自动检测" : externalDone ? "接管后可完整检测" : "连接后自动检测",
				tone: probeReady ? "done" : configured || externalDone ? "active" : undefined,
				actions: configured ? [React.createElement(Button, { key: "probe", onClick: refreshProbe, disabled: busy || !configured }, probe ? "重新检测" : "立即检测")] : null,
			},
				!configured
					? React.createElement(Empty, null, gateFor("probe"))
					: probe
						? React.createElement("div", null, checkRows)
						: React.createElement(Empty, null, "还没有检测结果，点右上角「立即检测」。"),
			);

			// 3. 一键部署 ------------------------------------------------------
			const deployOptions = React.createElement("div", null,
				React.createElement("div", { style: wiz.row },
					React.createElement(Button, { kind: "primary", onClick: () => runAction(deployed ? "update" : "deploy", {}), disabled: busy || !configured }, busy ? "任务运行中…" : deployLabel),
					React.createElement(Button, { onClick: () => setAdvanced((value) => !value), disabled: busy }, advanced ? "收起部署选项" : "部署选项"),
					deployed ? React.createElement(Button, { onClick: () => runAction("start-console", {}), disabled: busy }, "只重启控制台") : null,
					React.createElement(Button, { onClick: () => runAction("start-agent", {}), disabled: busy || !consoleOpen }, "启动 Agent"),
				),
				React.createElement("div", { style: wiz.hintSmall }, deployed
					? "已有部署：更新代码 → 重启控制台 → 完整自检；虚拟机的 .env 和数据库不会被覆盖。"
					: "首次部署：上传源码 → 安装系统依赖 → 创建 Python 环境 → 写入初始配置（默认只读、不自动回复）→ 启动控制台。"),
				advanced
					? React.createElement("div", { style: { marginTop: 10 } },
						React.createElement("div", { style: wiz.grid },
							React.createElement(SetupField, { label: "pip 镜像", hint: "国内建议清华源" },
								React.createElement(SetupInput, { value: pipIndex, onChange: setPipIndex, disabled: busy })),
							React.createElement(SetupField, { label: "sudo 密码", hint: "和 SSH 密码相同可留空" },
								React.createElement(SetupInput, { value: sudoPassword, onChange: setSudoPassword, type: "password", placeholder: "安装依赖时使用", disabled: busy })),
							React.createElement(SetupField, { label: "微信安装包路径", hint: "已装微信可留空" },
								React.createElement(SetupInput, { value: wechatDebPath, onChange: setWechatDebPath, placeholder: "本机路径，例如 D:\\wechat.deb", disabled: busy })),
						),
						React.createElement("div", { style: styles.cardHint }, "首次部署写入虚拟机 .env 的配置（模型密钥等；之后可在「设置」里改）："),
						React.createElement("div", { style: wiz.grid },
							React.createElement(SetupField, { label: "模型地址" },
								React.createElement(SetupInput, { value: env.LLM_BASE_URL, onChange: updateEnv("LLM_BASE_URL"), placeholder: "https://api.deepseek.com", disabled: busy })),
							React.createElement(SetupField, { label: "模型 Key" },
								React.createElement(SetupInput, { value: env.LLM_API_KEY, onChange: updateEnv("LLM_API_KEY"), type: "password", placeholder: "sk-…", disabled: busy })),
							React.createElement(SetupField, { label: "模型名" },
								React.createElement(SetupInput, { value: env.LLM_MODEL, onChange: updateEnv("LLM_MODEL"), placeholder: "deepseek-chat", disabled: busy })),
							React.createElement(SetupField, { label: "回复的群", hint: "多个用逗号分隔" },
								React.createElement(SetupInput, { value: env.WECHAT_GROUP_NAMES, onChange: updateEnv("WECHAT_GROUP_NAMES"), placeholder: "例如 测试群", disabled: busy })),
							React.createElement(SetupField, { label: "机器人昵称" },
								React.createElement(SetupInput, { value: env.WECHAT_SELF_NAME, onChange: updateEnv("WECHAT_SELF_NAME"), placeholder: "小鱼", disabled: busy })),
						),
					)
					: null,
			);

			const jobTone = job ? (job.status === "running" ? "warn" : job.status === "done" ? "ok" : "error") : "muted";
			const jobLabel = job ? (job.status === "running" ? "运行中" : job.status === "done" ? "已完成" : "失败") : "无任务";
			const jobPanel = job
				? React.createElement("div", { style: { marginTop: 10 } },
					React.createElement("div", { style: wiz.row },
						React.createElement(Pill, { tone: jobTone }, jobLabel),
						React.createElement("span", { style: { color: C.secondary } }, job.title),
						React.createElement("span", { style: { ...wiz.mono, color: C.muted } }, `${job.log ? job.log.length : 0} 行 · ${fmtTime(job.startedAt)}${job.finishedAt ? ` → ${fmtTime(job.finishedAt)}` : ` · 已运行 ${fmtDuration(job.startedAt)}`}`),
					),
					job.error ? React.createElement("div", { style: { marginTop: 6 } }, React.createElement(Banner, { tone: "error" }, job.error)) : null,
					React.createElement("div", { ref: logRef, style: wiz.log },
						(job.log || []).length ? (job.log || []).map((line, index) => React.createElement("div", { key: index }, line)) : React.createElement("div", { style: { color: C.muted } }, "等待日志…"),
					),
				)
				: React.createElement("div", { style: wiz.hintSmall }, "部署、更新、自检等任务的实时日志会显示在这里。");

			const step3 = React.createElement(SetupStep, {
				index: 3,
				title: "一键部署",
				hint: assets && assets.files ? `内置源码包 ${assets.files} 个文件` : "",
				tone: deployed ? "done" : probeReady ? "active" : configured ? undefined : externalDone ? "active" : undefined,
			},
				!configured
					? React.createElement(Empty, null, gateFor("deploy"))
					: React.createElement("div", null,
						deployOptions,
						actionState.state === "running" ? React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "brand" }, actionState.message)) : null,
						actionState.state === "done" ? React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "ok" }, actionState.message)) : null,
						actionState.state === "error" ? React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "error" }, `操作失败：${actionState.error}`)) : null,
						jobPanel,
					),
			);

			// 4. 微信登录与配置 ------------------------------------------------
			const wechatHint = !probe && !configured
				? (externalConnected || externalRemoteUrl
					? "部署页还没接管 SSH，暂时看不到虚拟机上的微信状态；接管后可以检测微信、启动图形界面并截图扫码。"
					: "先完成第 1 步连接虚拟机，再检测微信状态。")
				: !wechatInstalled
					? "虚拟机还没装微信：在「部署选项」里填官方 Linux 微信安装包路径后重新部署，或先手动装好微信。"
					: !wechatRunning
						? "先点「启动微信」启动图形界面，再点「查看虚拟机截图」显示二维码，用手机扫码登录。"
						: !(probe && probe.wechat && probe.wechat.dataDir)
							? "微信已运行，但还没识别到数据目录：等微信完全登录后点「自动识别账号」。"
							: "微信已登录。第一次使用建议依次执行「自动识别账号」「扫描数据库密钥」「完整自检」。";
			const step4Actions = [
				React.createElement(Button, { key: "shot", onClick: loadShot, disabled: !configured || shot.state === "loading" }, shot.state === "loading" ? "截图中…" : "查看虚拟机截图"),
				wechatInstalled && !wechatRunning
					? React.createElement(Button, { key: "wechat", kind: "primary", onClick: startWechat, disabled: busy }, confirmWechat ? "确认启动微信" : "启动微信")
					: null,
				wechatRunning
					? React.createElement(Button, { key: "agent", onClick: () => runAction("phase", { phase: "agent" }), disabled: busy }, "自动识别账号")
					: null,
				wechatRunning
					? React.createElement(Button, { key: "key", onClick: () => runAction("phase", { phase: "key" }), disabled: busy }, "扫描数据库密钥")
					: null,
				configured
					? React.createElement(Button, { key: "check", onClick: () => runAction("phase", { phase: "check" }), disabled: busy }, "完整自检")
					: null,
				configured
					? React.createElement(Button, { key: "autostart", onClick: () => runAction("phase", { phase: "autostart" }), disabled: busy }, "安装开机自启")
					: null,
				React.createElement(Button, { key: "settings", onClick: onOpenSettings }, "去设置里改模型/群"),
			];
			const step4 = React.createElement(SetupStep, {
				index: 4,
				title: "微信登录与配置",
				hint: probe
					? wechatRunning ? "微信运行中" : wechatInstalled ? "微信未运行" : "微信未安装"
					: externalDone || externalUrlDone ? "接管后可检测" : "连接后检测",
				tone: wechatRunning && Boolean(probe && probe.wechat && probe.wechat.dataDir) ? "done" : probeReady ? "active" : configured ? undefined : externalDone ? "active" : undefined,
			},
				!configured
					? React.createElement(Empty, null, gateFor("wechat"))
					: React.createElement("div", null,
						React.createElement(Banner, { tone: wechatRunning ? "ok" : "warn" }, wechatHint),
						React.createElement("div", { style: { marginTop: 6 } },
							React.createElement(KV, { label: "数据目录" }, (probe && probe.wechat && probe.wechat.dataDir) || "未识别"),
							React.createElement(KV, { label: "图形会话" }, sessionReady ? "已就绪" : "未就绪（控制台可能无法随微信重启）"),
						),
						React.createElement("div", { style: wiz.row }, step4Actions),
						confirmWechat ? React.createElement("div", { style: wiz.hintSmall }, "启动微信会在虚拟机桌面上打开微信窗口，然后需要手机扫码登录。") : null,
						shot.state === "ready" ? React.createElement("img", { src: shot.image, style: wiz.shot, alt: "虚拟机桌面截图" }) : null,
						shot.state === "error" ? React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: "error" }, `截图失败：${shot.error}`)) : null,
					),
			);

			// 5. 完成 ----------------------------------------------------------
			const step5 = React.createElement(SetupStep, {
				index: 5,
				title: "完成",
				hint: "控制台可用后，回到概览页操作 Agent",
				tone: consoleOpen ? "done" : undefined,
			},
				React.createElement("div", null,
					consoleOpen
						? React.createElement(Banner, { tone: "ok" }, `控制台已在线${probe && probe.console && probe.console.phase ? ` · 当前 ${probe.console.phase}` : ""}。可以到「概览」启动 Agent、开关回复、看消息统计。`)
						: React.createElement(Banner, { tone: "warn" }, "控制台还不可达：先完成部署，或点下面的按钮启动控制台，再刷新。"),
					React.createElement("div", { style: wiz.row },
						React.createElement(Button, { kind: consoleOpen ? "primary" : undefined, onClick: onOpenOverview }, "打开概览"),
						React.createElement(Button, {
							onClick: externalConnected || externalRemoteUrl
								? () => { reloadSetup(); if (reloadHealth) reloadHealth(); }
								: refreshProbe,
							disabled: busy,
						}, "刷新状态"),
					),
					assets && assets.builtAt ? React.createElement("div", { style: wiz.hintSmall }, `内置源码包版本：${fmtTime(assets.builtAt)}${assets.sha256 ? ` · ${assets.sha256.slice(0, 12)}` : ""}`) : null,
				),
			);

			// 连接操作页：所有需要用户输入的内容都收在 DSH 风格弹窗里，
			// 页面第 1 步只留一个「一键连接」入口。样式使用 DSH 设计变量
			//（--dsw-*），亮色/暗色主题都会自动跟随。
			const dialogButton = (label, onClick, options = {}) => React.createElement("button", {
				type: "button",
				onClick,
				disabled: Boolean(options.disabled),
				"aria-label": options.ariaLabel || undefined,
				style: { ...(options.primary ? dialog.buttonPrimary : dialog.button), ...(options.disabled ? dialog.buttonDisabled : {}) },
			}, label);

			const submitOnEnter = (event) => {
				if (event.key === "Enter" && !event.isComposing) connect();
			};

			const manualFields = React.createElement("div", { style: wiz.grid },
				React.createElement(SetupField, { label: "虚拟机地址", hint: "在虚拟机里运行 hostname -I 查看" },
					React.createElement(SetupInput, { value: form.host, onChange: updateForm("host"), placeholder: "例如 192.168.1.50", disabled: busy, style: dialog.input })),
				React.createElement(SetupField, { label: "SSH 端口", hint: "一般 22" },
					React.createElement(SetupInput, { value: form.port, onChange: updateForm("port"), type: "number", disabled: busy, style: dialog.input })),
				React.createElement(SetupField, { label: "用户名", hint: "在虚拟机里运行 whoami 查看" },
					React.createElement(SetupInput, { value: form.username, onChange: updateForm("username"), placeholder: "例如 wx", disabled: busy, style: dialog.input })),
				React.createElement(SetupField, { label: "登录方式" },
					React.createElement(SetupSelect, { value: form.authType, onChange: updateForm("authType"), style: dialog.input, options: [{ value: "password", label: "密码（推荐）" }, { value: "key", label: "SSH 私钥" }] })),
				form.authType === "password"
					? React.createElement(SetupField, { label: "SSH 密码", hint: "开机登录密码；sudo 也用它" },
						React.createElement(SetupInput, { value: form.password, onChange: updateForm("password"), type: "password", placeholder: "虚拟机登录密码", disabled: busy, style: dialog.input, onKeyDown: submitOnEnter }))
					: React.createElement(SetupField, { label: "私钥路径", hint: "留空用默认" },
						React.createElement(SetupInput, { value: form.privateKeyPath, onChange: updateForm("privateKeyPath"), disabled: busy, style: dialog.input })),
				form.authType === "key"
					? React.createElement(SetupField, { label: "私钥口令", hint: "没有就留空" },
						React.createElement(SetupInput, { value: form.passphrase, onChange: updateForm("passphrase"), type: "password", disabled: busy, style: dialog.input }))
					: null,
				React.createElement(SetupField, { label: "项目目录", hint: "部署到这里" },
					React.createElement(SetupInput, { value: form.projectDir, onChange: updateForm("projectDir"), disabled: busy, style: dialog.input })),
				React.createElement(SetupField, { label: "控制台端口", hint: "默认 8765" },
					React.createElement(SetupInput, { value: form.consolePort, onChange: updateForm("consolePort"), type: "number", disabled: busy, style: dialog.input })),
			);

			const connectStep = (index, title, children) => React.createElement("section", { style: dialog.step },
				React.createElement("div", { style: dialog.stepHead },
					React.createElement("span", { style: wiz.stepIndex }, String(index)),
					React.createElement("span", { style: dialog.stepTitle }, title)),
				children);

			const externalLink = (label, href) => React.createElement("a", {
				href,
				target: "_blank",
				rel: "noreferrer noopener",
				style: dialog.externalLink,
			}, label);

			const guideItem = (step, title, children) => React.createElement("div", { style: dialog.guideItem },
				React.createElement("div", { style: dialog.guideItemTitle }, step ? `${step}. ${title}` : title),
				React.createElement("div", { style: dialog.guideText }, children));

			// 第一次用虚拟机的人占大多数：把「下载 Ubuntu / 装 VMware / 打开终端 /
			// 粘贴命令 / 复制连接码」全部收进操作页，不用到处搜教程。
			const vmGuide = React.createElement("details", { style: dialog.details },
				React.createElement("summary", { style: dialog.detailsSummary }, "第一次用？虚拟机里还没装 Ubuntu / 不会打开终端？点这里看步骤"),
				React.createElement("div", { style: dialog.detailsBody },
					guideItem("", "先回答：没装过 Ubuntu 可以吗？",
						"可以，但虚拟机里必须装 Ubuntu / Xubuntu 24.04 LTS（X11 桌面），插件才能连。\n如果虚拟机里现在是 Windows、macOS、Deepin 或别的 Linux，需要重新装一个 Ubuntu；没有虚拟机就从第 1 步开始。\nUbuntu 22.04 及更早版本 Python 太旧，不满足要求；请用 24.04 LTS。"),
					guideItem("1", "装虚拟机软件（VMware Workstation 17）",
						["打开 ", externalLink("VMware Workstation 17.6.1 安装包（夸克网盘）", VMWARE_SHARE_URL), "，点“保存到网盘”后下载 ", VMWARE_INSTALLER_NAME, "。\n下载完双击安装，按提示一路“下一步”；如果提示重启，先保存工作再重启。\n链接打不开时，复制分享内容 /~69743c2dbC~:/ 打开夸克 APP 获取。"]),
					guideItem("2", "下载 Ubuntu / Xubuntu 系统镜像",
						["推荐 ", externalLink("Xubuntu 24.04 LTS 下载（xubuntu.org/release/24.04）", "https://xubuntu.org/release/24.04/"), "（比 Ubuntu 轻，适合虚拟机跑微信）；也可以用 ", externalLink("Ubuntu Desktop 24.04 LTS 下载（releases.ubuntu.com/24.04）", "https://releases.ubuntu.com/24.04/"), "。\n认准 “24.04 LTS” 和 64-bit / amd64，不要选 ARM；文件约 3–5 GB，下载需要一些时间。"]),
					guideItem("3", "在 VMware 里新建虚拟机并安装系统",
						"打开 VMware Workstation →“创建新的虚拟机” → 选“典型” → 选“安装程序光盘映像文件（ISO）”，选中刚下载的 ISO → 下一步。\n客户机系统选 Linux、版本 Ubuntu 64 位（识别不到就手动选）→ 名称和位置随意 → 磁盘 40 GB → 下一步。\n点“自定义硬件”：内存 8192 MB（最低 4096 MB）、处理器 4、网络适配器先保持 NAT；点“完成”，再点“开启此虚拟机”。\n按向导选中文、时区 Asia/Shanghai、用户名建议 wx、最小安装；装完重启（如果又从 ISO 启动，在 VMware 里把光驱断开）。"),
					guideItem("4", "打开终端（复制命令要用）",
						"进入 Ubuntu 桌面后，任选一种：\n① 直接按 Ctrl + Alt + T（最推荐，Xubuntu / Ubuntu 默认快捷键）；\n② 点左上角或左下角的“应用程序菜单 / 开始”图标，搜索“终端”或 Terminal，点“终端模拟器 / Terminal”；\n③ 在桌面空白处点右键，如果有“在此处打开终端”就点它；\n④ 找不到就点左上角 → 所有应用程序 → 找“终端”。"),
					guideItem("5", "把命令粘贴到终端并回车",
						"回到 DSH 操作页，点“复制命令”。\n到虚拟机终端窗口里右键 →“粘贴”（或按 Ctrl + Shift + V；终端里直接 Ctrl+V 通常没用），然后按回车。\n如果提示 [sudo] password for wx:（wx 是示例用户名，按你实际的用户名），输入开机登录密码；屏幕上不显示任何字符是正常的，输完直接回车。\n等它打印出 WECHAT-VM-CODE:... 这一行再继续。"),
					guideItem("6", "把连接码复制回 DSH",
						"用鼠标选中 WECHAT-VM-CODE: 这一整行（从 W 到最后），右键 →“复制”（或按 Ctrl + Shift + C）。\n回到 DSH 操作页，粘贴到第 2 步输入框，再输入开机密码，点“一键连接”。SSH 会由插件自动安装和配置，不用你另外装。"),
					guideItem("7", "如果确实打不开终端",
						"在虚拟机里按 Ctrl + Alt + F3 可以切到字符终端（黑屏白字），输入用户名和密码登录后也能执行命令；回到图形桌面一般按 Ctrl + Alt + F7。新手优先用第 4 步的菜单找“终端”，字符终端只作为备用。"),
					guideItem("8", "链接打不开怎么办",
						"在 Windows 浏览器手动输入：pan.quark.cn/s/3f0e0687094d、xubuntu.org/release/24.04、releases.ubuntu.com/24.04。网盘链接需要先保存到自己的网盘再下载；官方系统页会自动推荐最近的镜像。")));

			const onboardSteps = React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
				connectStep(1, "在虚拟机里运行这一行命令",
					React.createElement("div", null,
						React.createElement("div", { style: dialog.actions },
							dialogButton(beginnerCopied ? "已复制，去粘贴" : "复制命令", copyOnboardCommand, { disabled: busy }),
							React.createElement("span", { style: dialog.note }, beginnerCopied ? "已复制到剪贴板。" : "会打开 SSH 并打印连接码，不会改密码。")),
						React.createElement("pre", { style: dialog.command }, ONBOARD_COMMAND),
						React.createElement("div", { style: dialog.note }, "到虚拟机桌面按 Ctrl + Alt + T（或菜单里搜“终端”）打开终端，右键粘贴后回车；没装 SSH 时会要一次开机密码。不会开终端？展开下面的教程。"))),
				vmGuide,
				connectStep(2, "把终端最后一行的连接码粘到这里",
					React.createElement("div", null,
						React.createElement(SetupInput, { value: beginnerCode, onChange: onBeginnerCodeChange, placeholder: "WECHAT-VM-CODE:用户名@IP:22", disabled: busy, style: dialog.input, onKeyDown: submitOnEnter }),
						React.createElement("div", { style: { ...dialog.note, marginTop: 6 } }, "形如 ", connectCode("WECHAT-VM-CODE:用户名@IP:22"), "；识别后会自动填好 IP、用户名和端口。"),
						beginnerNotice.text ? React.createElement("div", { style: { marginTop: 8 } }, React.createElement(Banner, { tone: beginnerNotice.tone || "brand" }, beginnerNotice.text)) : null)),
				connectStep(3, "输入虚拟机登录密码",
					React.createElement("div", null,
						React.createElement(SetupInput, { value: form.password, onChange: updateForm("password"), type: "password", placeholder: "开机登录密码", disabled: busy, style: dialog.input, onKeyDown: submitOnEnter }),
						React.createElement("div", { style: { ...dialog.note, marginTop: 6 } }, "密码只保存在这台电脑的 DSH 配置里，不会上传到别处。"))));

			const takeoverBanner = takeover && externalSsh
				? React.createElement(Banner, { tone: "brand" }, `已按插件设置预填：${external.username}@${external.host}，默认用本机 SSH 私钥（~/.ssh/id_ed25519）接管。确认后点「一键连接」。`)
				: takeover && externalRemoteUrl
					? React.createElement(Banner, { tone: "brand" }, `已按插件设置预填地址：${external.target}；补齐 SSH 用户名和密码即可。`)
					: null;

			const connectModal = showConnectModal
				? React.createElement("div", { style: dialog.overlay, onMouseDown: (event) => { if (event.target === event.currentTarget) cancelConnectModal(); } },
					React.createElement("div", { ref: modalRef, role: "dialog", "aria-modal": "true", tabIndex: -1, "aria-label": manualMode ? "手动填写连接信息" : "连接虚拟机", style: dialog.panel },
						React.createElement("div", { style: dialog.header },
							React.createElement("div", { style: { flex: 1, minWidth: 0 } },
								React.createElement("div", { style: dialog.title }, configured ? "重新连接虚拟机" : "连接虚拟机"),
								React.createElement("div", { style: dialog.subtitle }, manualMode ? "手动填写 IP、端口和登录方式" : "小白一键连接 · 不用查 IP，按 3 步完成")),
							React.createElement("button", {
								type: "button",
								onClick: cancelConnectModal,
								disabled: busy || connectState.state === "running",
								"aria-label": "关闭",
								style: { ...dialog.close, ...(busy || connectState.state === "running" ? dialog.buttonDisabled : {}) },
							}, "×")),
						React.createElement("div", { style: dialog.body },
							takeoverBanner,
							manualMode
								? manualFields
								: onboardSteps,
							connectBanner(connectState),
							React.createElement("div", { style: dialog.linkRow },
								React.createElement("span", { style: dialog.link, onClick: () => setManualMode((value) => !value) }, manualMode ? "改回一键连接方式" : "手动填写 IP / 端口 / 用户名"),
								React.createElement("span", { style: { ...dialog.link, color: "var(--dsw-alias-label-tertiary, #888)" }, onClick: () => setShowConnectHelp((value) => !value) }, showConnectHelp ? "收起排查说明" : "连不上？展开排查说明")),
							showConnectHelp ? connectHelp : null),
						React.createElement("div", { style: dialog.footer },
							dialogButton("取消", cancelConnectModal, { disabled: connectState.state === "running" }),
							dialogButton(connectState.state === "running" ? "连接中…" : configured ? "保存并重新连接" : "一键连接", connect, { primary: true, disabled: busy || connectState.state === "running" }))))
				: null;

			return React.createElement("div", { style: styles.section }, step1, step2, step3, step4, step5, connectModal);
		}

		// -------------------------------------------------------------- page shell

		function WechatConsole() {
			const [tab, setTab] = React.useState("overview");
			const [health, reloadHealth] = useResource(HEALTH_URL, 15000);
			const [setup, reloadSetup] = useResource(SETUP_STATE_URL, 8000);
			const label = healthLabel(health);
			const detail = healthDetail(health);
			const starting = healthStarting(health);
			const unreachable = health.status === "ready" && health.data && health.data.reachable === false;
			return React.createElement("div", { style: styles.page, "data-wechat-console": "1" },
				React.createElement("div", { style: styles.pageHead },
					React.createElement("div", null,
						React.createElement("h1", { style: styles.h1 }, "微信 Agent"),
						React.createElement("div", { style: styles.sub }, `虚拟机自动回复控制台${label ? ` · ${label}` : ""}${health.status === "ready" && health.data && health.data.target ? ` · ${health.data.target}` : ""}`),
					),
					React.createElement("div", { style: styles.headActions },
						starting ? React.createElement(Pill, { tone: "warn" }, "连接中") : unreachable ? React.createElement(Pill, { tone: "error" }, "控制台不可达") : null,
						React.createElement(Button, { onClick: reloadHealth }, "重连"),
					),
				),
				unreachable && detail
					? React.createElement(Banner, { tone: starting ? "brand" : "error" }, starting ? `正在建立 SSH 隧道，控制台马上就好…（${detail}）` : detail)
					: null,
				React.createElement("nav", { style: styles.nav },
					TABS.map((item) => React.createElement("button", { key: item.id, type: "button", style: { ...styles.navTab, ...(tab === item.id ? styles.navTabActive : {}) }, onClick: () => setTab(item.id) }, item.label)),
				),
				tab === "overview" ? React.createElement(OverviewTab, { setup, onOpenDeploy: () => setTab("deploy") }) : null,
				tab === "deploy" ? React.createElement(DeployTab, { setup, reloadSetup, reloadHealth, health, onOpenSettings: () => setTab("settings"), onOpenOverview: () => setTab("overview") }) : null,
				tab === "echo" ? React.createElement(EchoTab, null) : null,
				tab === "platform" ? React.createElement(PlatformTab, null) : null,
				tab === "logs" ? React.createElement(LogsTab, null) : null,
				tab === "settings" ? React.createElement(SettingsTab, null) : null,
			);
		}

		function WechatPage() {
			return React.createElement(PageBoundary, null, React.createElement(WechatConsole));
		}

		// ------------------------------------------------------------------ apply

		function apply(ctx) {
			if (!ctx || !ctx.slots) return;
			// Full control page as a conversation tab next to 对话 / 轨迹.
			ctx.slots.inject(VIEW_SLOT, () => ctx.slots.register(
				{ name: VIEW_SLOT, id: "wechat-agent", order: 20, label: "微信" },
				() => React.createElement(WechatPage),
			));
			// Same page as a first-level settings section, reachable without a session.
			ctx.slots.inject(SETTINGS_SLOT, () => ctx.slots.register(
				{ name: SETTINGS_SLOT, id: "wechat-agent", order: 420, label: "微信 Agent" },
				() => React.createElement(WechatPage),
			));
		}

		exports.apply = apply;
		exports.inject = ["slots"];
		// 只给离线冒烟测试用：一键连接命令与连接码解析。
		exports.__onboardCommand = ONBOARD_COMMAND;
		exports.__parseOnboardCode = parseOnboardCode;
		return module.exports;
	},
});
