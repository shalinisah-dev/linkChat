# Architecture

## Customer request path

```text
User clicks Create DM options
  -> optional linkedin.com permission is requested
  -> service worker reads the active visible LinkedIn page
  -> page capture selects profile facts and up to 10 visible activity items
  -> side panel normalizes and scans the text as untrusted input
  -> if configured: one bounded POST goes to the fixed LinkChat HTTPS API
     -> API validates extension origin, install ID, body size, and rate limit
     -> API calls OpenAI Responses with strict JSON Schema and store:false
  -> otherwise, or on a transient service failure: deterministic on-device drafts
  -> either path independently validates grounding, length, and source overlap
  -> only recipient analysis + three editable drafts return
  -> raw capture references are cleared; nothing is sent to LinkedIn
```

## Trust boundaries

- LinkedIn content is untrusted evidence, never instructions.
- The extension has optional access only to `linkedin.com` and persistent network access only to one LinkChat HTTPS origin.
- The OpenAI key exists only as a backend secret. It is never built into Chrome code.
- CORS origin checks reduce accidental exposure but are not authentication. The preview's random install ID and approximate rate limit are an abuse-control baseline, not a user account.
- Production accounts must provide signed user identity, entitlements, revocation, and a stable per-user rate-limit key.

## Deterministic boundaries

- Capture classification, activity caps, text normalization, injection detection, request size, goal labels, approach catalog, JSON Schema, three-option cardinality, 120-word cap, and source-overlap rejection are code—not model discretion.
- The model selects one allowed approach and writes within those constraints.
- The deployment supplies an explicit model identifier. Model upgrades require evals and a passing hosted smoke test.

## Runtime components

- `service-worker.js`: active-tab check and user-triggered page extraction.
- `src/page-capture.js`: deterministic visible-content extraction and top-10 activity cap.
- `sidepanel.js`: outcome UI, transient request assembly, safe output rendering.
- `src/api-client.js`: fixed-host HTTPS client, timeout, and structured errors.
- `src/local-draft.js`: deterministic, conservative on-device fallback that requires no service.
- `backend/worker.js`: CORS, request limits, rate limiting, Responses call, and independent validation.
- `scripts/smoke-hosted.mjs`: real deployed-service release gate.

The `vault-template/` is an offline evaluation/reference corpus for profile formation and outcome-learning experiments. The current composer neither initializes it nor persists profile or DM history.
