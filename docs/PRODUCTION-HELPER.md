# Legacy local-helper design (retired)

This document is retained only as an incident/design record. LinkChat 0.6.0 removed the customer-facing local helper. Production uses a fixed hosted HTTPS API. Do not ship, package, or restore the helper UX described below.

The official ChatGPT-plan OAuth flow needs a trusted local component. That requirement must not become terminal-based customer onboarding.

## Customer experience

1. Install LinkChat once from a signed and notarized macOS package.
2. Add the Chrome extension.
3. Click **Continue with ChatGPT**.
4. Use LinkChat. No Terminal, Node.js, npm, project folder, open process window, or manual restart.

If the helper is absent, the released extension may offer one clear **Install LinkChat** action. It must not expose development commands.

## Required implementation

- A signed, notarized universal macOS helper with its runtime embedded.
- Chrome Native Messaging for extension/helper communication; no user-managed port or Local Network Access prompt.
- A signed installer that registers the native-messaging host for the published extension ID.
- Launch-on-demand or managed background startup, automatic crash recovery, and clean uninstall.
- OAuth credentials in Keychain, not a plaintext file.
- Authenticated request envelopes and a strict command allowlist: status, authorize, draft, smoke, disconnect.
- No LinkedIn send capability and no raw profile persistence.
- Signed update channel with rollback and version compatibility checks.

## Release gates

- Fresh macOS user account: install → connect → draft without opening Terminal.
- Chrome stable: native-host discovery, OAuth callback, profile capture, and disconnect.
- Missing, outdated, crashed, and tampered-helper recovery states.
- Keychain access and uninstall-data-removal verification.
- Real OpenAI smoke test and real LinkedIn-page smoke test on the packaged artifact.

The current loopback Node companion and `start-linkchat.command` are development tools. They are not production distribution artifacts.
