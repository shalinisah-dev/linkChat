# LinkChat engineering rules

Adapted from `multica-ai/andrej-karpathy-skills` (MIT), copied locally at `/Users/shalinisah/dev/andrej-karpathy-skills`.

## Think before coding

- State assumptions that affect behavior, privacy, or architecture.
- Surface ambiguity and meaningful tradeoffs instead of silently choosing.
- Prefer a simpler valid design; push back on complexity without a concrete benefit.
- Stop and ask only when a missing answer would materially change the result.

## Simplicity first

- Write the minimum code needed for the requested behavior.
- Do not add speculative features, extension points, or single-use abstractions.
- Keep the browser extension thin; credentials and OpenAI calls belong in the hosted LinkChat API.
- If an implementation is materially larger than the behavior warrants, simplify it before handoff.

## Surgical changes

- Every changed line must trace to the request or to verification of that request.
- Preserve existing style and unrelated user changes.
- Remove only dead code introduced by the current change; report unrelated issues instead of sweeping them in.

## Goal-driven execution

- Translate work into observable success criteria before implementation.
- Reproduce bugs with tests, then make those tests pass.
- Run the smallest relevant test while iterating and the full verification suite before handoff.
- A model-backed feature is not proven by mocks alone: keep deterministic integration tests and require `npm run smoke:live` for a real-account release gate.

## LinkChat release criteria

- No API keys or OAuth tokens in the extension.
- No raw LinkedIn capture rendered or persisted by LinkChat.
- Exactly three schema-valid, editable drafts or a specific recovery error.
- Hosted API is HTTPS-only, rejects untrusted extension origins, and fails closed without rate limiting.
- `npm run verify` passes; a release additionally requires a passing live smoke test.
- Customer UI never mentions Terminal, npm, Node, project folders, `.command` files, or keeping a process window open.
- Production has no local helper. The extension calls one fixed HTTPS LinkChat API; model secrets remain server-side.
