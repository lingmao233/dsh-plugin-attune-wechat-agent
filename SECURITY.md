# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Use GitHub's private vulnerability reporting on this repository:

<https://github.com/lingmao233/dsh-plugin-wechat-agent/security/advisories/new>

Include the affected version, a minimal reproduction, and the impact. We will
acknowledge the report and coordinate a fix before any public disclosure.

## Credentials and private data

This plugin stores SSH connection details in
`~/.dsh/wechat-agent-setup.json` on the DSH machine (mode `0600`). It does not
upload them. The VM password and model API keys live in the VM's `.env`.

If you believe a credential was exposed:

1. Disconnect the VM from the deploy page (this deletes the saved connection).
2. Rotate the VM login password and any model API keys.
3. Rotate the WeChat test account session if its data was exposed.
4. Check `git log --all -S '<secret>'` and remove the secret from history before
   publishing a fork.

## WeChat account risk

Automating WeChat can lead to account restrictions. Use a dedicated test
account, not your primary account. The project defaults to read-only
(`WECHAT_ALLOW_SEND=false`) on a fresh deployment.

## Supported versions

Only the latest release on `main` is supported with security fixes.
