# Integration incident ledger

Each entry records a user-visible failure, its root cause, and the automated or release guard that prevents a silent repeat. Passing mocks alone is not evidence that the Chrome product works.

## 2026-10-28 — Setup command unavailable

- Symptom: the UI instructed the user to run `npm run companion`, but `npm` was not on the user's shell path.
- Root cause: setup was tested inside the development runtime, not from the user's clean shell.
- Fix: ship `start-linkchat.command`, which locates the available runtime and starts the companion directly.
- Permanent gate: syntax-check the launcher and exercise that launcher during manual first-run testing.

## 2026-10-28 — Healthy companion reported as offline

- Symptom: the companion returned HTTP 200 locally while the extension displayed “not running.”
- Root cause: Chrome's Local Network Access flow requires a loopback declaration and the first permission-triggering request to follow a user gesture.
- Fix: use `targetAddressSpace: "loopback"`; query `loopback-network`; initiate the first request from **Connect LinkChat**.
- Permanent gate: contract tests assert the loopback fetch option, user-gesture state exists, and the real extension origin receives CORS permission.

## 2026-10-29 — Structured error displayed as `[object Object]`

- Symptom: Chrome surfaced `LinkChat request failed [object Object]` while ChatGPT authorization was incomplete.
- Root cause: object-shaped errors crossed the extension boundary without normalization; the release version was not bumped after fixes.
- Fix: recursively normalize error code/message fields, fail closed when `connected:false`, and bump the visible build version.
- Permanent gate: regression test rejects object coercion; manifest and package versions must match.

## Release evidence levels

1. **Deterministic:** syntax, unit/contract tests, evals, and engineering reviews pass.
2. **Browser integration:** the currently loaded Chrome build completes first-run permission, OAuth callback, profile capture, rendering, and recovery-state checks.
3. **Live inference:** `npm run smoke:live` completes a real OpenAI stream and validates exactly three drafts.

A build is not production-ready until all three levels pass on the release artifact.

## 2026-10-29 — Developer process exposed as onboarding

- Symptom: the extension instructed an end user to find a project folder, double-click a `.command` file, and keep its window open.
- Root cause: development transport startup was presented as product setup instead of being classified as a release blocker.
- Fix: remove all developer commands from customer UI and label the current build as development-only when the helper is unavailable.
- Permanent gate: customer UI tests reject `npm`, Terminal, Node, project-folder, `.command`, and keep-a-window-open instructions; production requires the signed helper contract.
