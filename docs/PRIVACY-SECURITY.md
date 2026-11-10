# Privacy and security

Raw LinkedIn text always exists transiently in the active tab and extension memory. In on-device mode it goes no further. When the hosted service is configured, it also exists transiently in the LinkChat API request and OpenAI request. Processing starts only after **Create DM options**. LinkChat does not render the capture, write it to browser or server storage, or expose it through its API response. Hosted OpenAI requests set `store: false`. JavaScript references are cleared after completion; that is minimization, not a guarantee of immediate memory overwrite by managed runtimes.

The extension persists only a random installation UUID used for rate limiting. It does not persist profile content, prompts, recipient analysis, drafts, LinkedIn identifiers, or message outcomes. LinkChat never sends or edits LinkedIn messages.

The extension can contact only one fixed HTTPS API origin. The backend allowlists published Chrome-extension origins, caps bodies, fails closed without rate limiting, keeps the OpenAI key in a secrets manager, constrains model output with strict JSON Schema, and performs independent validation including a verbatim-overlap guard. Logs must exclude request bodies and generated messages; operational logs should retain only timestamps, status/error codes, latency, token counts/cost, and request IDs.

The preview's anonymous install ID is not strong authentication and can be reset. Before public production, add signed LinkChat user sessions, per-user entitlements, strict spend controls, bot/abuse protection, key rotation, vulnerability reporting, incident response, privacy-policy/legal review, and tested access/deletion procedures.
