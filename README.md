# LinkChat

LinkChat is a Chrome side-panel extension that reads the LinkedIn page the user is viewing and creates a grounded recipient analysis plus three editable DM options. The user clicks once; there is no Terminal, Node.js, local helper, or ChatGPT-account setup in the customer experience.

## Current status

Version 0.6.1 is a working preview. With the checked-in reserved API hostname (`api.linkchat.example`), the extension creates three deterministic DM options entirely on-device. A deployed backend upgrades the same interaction to model-generated recipient analysis and drafts; it is not required for the button to work.

## Architecture

1. The user opens a LinkedIn profile or activity page, chooses an outcome, and clicks **Create DM options**.
2. Chrome requests LinkedIn access at that moment and captures only visible, relevant page text.
3. If the LinkChat HTTPS API is configured and reachable, the extension sends one bounded request to it. Otherwise it creates conservative, outcome-specific drafts on-device.
4. The hosted API rate-limits the installation, sends a strict-schema Responses API request with `store: false`, independently validates the result, and returns only derived analysis and drafts.
5. Captured text is cleared in the side panel and is never rendered or written to storage. LinkChat never sends a DM.

The extension stores one random installation ID for rate limiting. It does not store profile content, prompts, analyses, drafts, or LinkedIn identifiers.

## Developer verification

Use Node.js 20+ (developer tooling only):

```bash
pnpm install
pnpm run verify
```

The deterministic suite covers capture, prompt-injection handling, output validation, hosted API CORS, request limits, rate-limit fail-closed behavior, structured errors, and the end-to-end extension/API/model contract with a fake model service.

## Release deployment

The supplied Cloudflare Worker is one small reference deployment; another fixed HTTPS backend can implement the same contract.

1. Replace the placeholders in `wrangler.jsonc` with a pinned model and the published Chrome extension origin.
2. Add `OPENAI_API_KEY` as a Cloudflare secret, never as a plaintext variable.
3. Deploy the Worker under the production API hostname.
4. Replace `api.linkchat.example` in `manifest.json` and `src/api-client.js` with that exact hostname.
5. Load or publish the resulting extension, then run:

```bash
LINKCHAT_API_BASE_URL=https://your-api.example \
LINKCHAT_EXTENSION_ORIGIN=chrome-extension://your-extension-id \
pnpm run verify:release
```

The release command must make a real hosted model request and validate three complete drafts plus a request ID. Mocks alone are not a release gate.

## Product work still required

The preview uses an anonymous per-install trial ID with an approximate rate limit. Before broad public launch, add real LinkChat accounts, per-user entitlements, spend limits, abuse monitoring, support/incident operations, privacy terms, deletion/access handling, and Chrome Web Store review. Those belong to LinkChat—the extension must not ask customers to install developer tooling.
