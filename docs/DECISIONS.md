# Product decisions

## Decisions implemented

| Area | Decision | Reason |
| --- | --- | --- |
| First release | Local Markdown vault only | Makes the contract testable with Claude Code and Codex and avoids a server. |
| Browser | Chrome 114+ Manifest V3 | Chrome Side Panel begins at 114; MV3 is the current extension format. |
| Front end | Plain JavaScript modules, HTML, and CSS | No build step, dependency supply chain, or framework runtime is needed for this small panel. |
| Persistence | File System Access API; directory handle in IndexedDB | Writes directly to a user-approved folder without native messaging. |
| Profile capture | Selection first, visible main-page text second; source body remains internal evidence | User control plus resilience to DOM changes without exposing extracted text as a product result. |
| Activity capture | User opens Posts, Comments, or Reactions; one click captures at most 10 rendered cards | Adds behavioral evidence without background navigation, scrolling, or broad host access. |
| Recipient profiling | Dedicated evidence-weighted skill with category-specific confidence rules | Prevents reactions and thin evidence from being overinterpreted. |
| Learning memory | Immutable Markdown cases plus a cross-case playbook | Exact, inspectable retrieval is more appropriate than embeddings for a small structured vault. |
| Agent integration | Markdown instructions and skills | Agent-agnostic, inspectable, and versionable. |
| Model calls | None in the extension | Prevents accidental disclosure and keeps the first milestone focused. |
| Sending | Never | User remains the final reviewer and sender. |
| Suspicious content | Save to quarantine, do not silently drop | Preserves evidence while keeping normal agent sweeps away from it. |
| Lens blend | At most two plus a direct control | Matches the product spec and avoids incoherent blends. |

## Decisions the product owner still needs to make

### Needed before a 20-person pilot

1. **Profile-reading scope:** keep generic active-tab capture, or restrict the extension to LinkedIn profile URLs after legal review.
2. **Quarantine release flow:** manual file move, an in-extension “review and release” action, or never process flagged captures.
3. **Signals UI:** show raw scores and evidence, or only plain-language summaries and confidence.
4. **Outcome vocabulary:** define the small fixed set used for learning: reply, no reply after N days, meeting, referral, declined, or custom.
5. **Voice presets:** approve final wording for Peer Operator, Warm Connector, Formal Executive, and Founder-to-Founder.
6. **Communicator naming:** keep public-figure names, use neutral behavioral names, or show both. Neutral names reduce endorsement and imitation concerns.
7. **Retention:** keep contact and case history indefinitely, offer a default expiry, or require manual cleanup.
8. **Vault location guidance:** local-only folder by default, or allow iCloud/Dropbox/Drive folders with an explicit “this syncs off-device” warning.
9. **Pilot success bar:** define what counts as “drafts you would send” across the first 20 real conversations.
10. **Legal go/no-go:** obtain current review of LinkedIn terms and Chrome Web Store policies before distributing beyond local development.

### Needed before model-backed drafting or a paid tier

1. Which provider and model handles Recipient Read, drafting, and critique?
2. Is inference BYO-key only, a stateless proxy, or an optional local model?
3. What provider retention settings and data-processing terms are acceptable?
4. Is the daily limit local and honor-based, or account-enforced?
5. What exact pricing and entitlement boundaries apply?
6. Should MCP expose typed vault operations, and which operations remain human-confirmed?
7. May analytics record only counts locally, or should any aggregate events leave the device?
8. Who owns security response, privacy requests, and vault-schema migrations?

Do not add a server, login, telemetry, auto-send, bulk capture, or a model API until those decisions are explicit.
