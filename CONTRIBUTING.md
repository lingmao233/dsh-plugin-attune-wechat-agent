# Contributing

Thanks for improving `dsh-plugin-wechat-agent`.

## Before you start

- Use a **dedicated test WeChat account**, never a primary account.
- Do not commit real VM addresses, usernames, passwords, model API keys,
  WeChat cookies, QR codes, database files, or `~/.dsh/wechat-agent-setup.json`.
- Keep changes focused. If a change touches the deploy flow, security boundary,
  or public API, explain the threat model in the PR.

## Local development

Requirements: Node.js `^22.19.0` or `>=24`, and a DeepSeek Harness desktop
installation for manual UI testing.

```powershell
npm ci --omit=peer
npm run check
```

This public release intentionally ships without test files. Before opening a
PR, run `npm run check` and manually exercise the changed flow in a real DSH
instance. For a real SSH check, use only a disposable test VM and a dedicated
test WeChat account.

## Pull requests

1. Fork the repository and create a topic branch.
2. Run `npm run check` before pushing.
3. Update `README.md` when user-facing behavior or configuration changes.
4. Describe what was tested manually (offline vs. real VM) and include redacted
   logs. Use only a disposable test VM and a dedicated test WeChat account.
5. By submitting a PR you agree that your contribution is licensed under MIT.

## Code style

- Node host code uses ESM, two-space indentation and no build step for the
  client (`lib/client.js` is plain `React.createElement`, no JSX).
- Keep the client compatible with the DSH theme tokens (`--dsw-*`); do not
  hard-code light/dark colors where a token exists.
- No new runtime dependency unless it is necessary and license-compatible.

## Reporting bugs

Open a GitHub issue with DSH version, Node version, OS, and sanitized error
output. Security issues go through [SECURITY.md](SECURITY.md), not the issue
tracker.
