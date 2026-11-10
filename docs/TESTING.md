# Testing

## Deterministic suite

Run `pnpm run verify` with Node.js 20+. This checks syntax, unit/contract tests, hosted API integration, privacy/security/performance/reliability reviews, and deterministic evals.

The hosted integration test exercises the full request path with a fake OpenAI endpoint and asserts `store:false`, strict schema, trusted-origin enforcement, fail-closed rate limiting, structured error rendering, and no `[object Object]` regression.

## Manual extension test

The checked-in build intentionally points at the reserved `api.linkchat.example` hostname. Configure and deploy a real API before manual product testing, then update the exact API origin in both `manifest.json` and `src/api-client.js`.

1. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked** (or click **Reload** if already loaded).
2. Open a LinkedIn profile and LinkChat. There must be no ChatGPT connection card, helper message, Terminal instruction, or setup step.
3. Choose an outcome and click **Create DM options**. Grant LinkedIn access if Chrome asks.
4. Confirm one recipient analysis and exactly three editable drafts appear; raw captured text must never appear.
5. Repeat on a non-LinkedIn tab, an incomplete page, an activity page, an injected-instruction fixture, a rate-limited install, an offline service, and a timed-out service. Every case must produce a specific recovery message and never send a DM.

## Release smoke

Run `pnpm run verify:release` with `LINKCHAT_API_BASE_URL` and `LINKCHAT_EXTENSION_ORIGIN` set to the deployed release candidate. It makes a real inference request and fails unless the response contains three valid drafts and a request ID.
