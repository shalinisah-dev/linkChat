# LinkChat case schema

The case writer produces `linkchat-case/v1` Markdown under `memory/cases/`.

Required input fields:

- `contact_name` or `contact_slug`
- `occurred_at`: ISO date or timestamp
- `direction`: `outbound` or `inbound`
- `objective`: concise free text
- `lens`: skill/lens name or `unknown`
- `outcome`: `reply`, `no-reply`, `meeting`, `referral`, `declined`, `ongoing`, or `unknown`
- `exact_message`: exact quoted text
- `profile_version`: contact profile version or `unknown`

Conditionally required: `evaluation_window_days` is a positive integer for `no-reply`.

Optional fields: `case_id`, `user_rating` (1-5), `recipient_axes` (string array), `recipient_reply`, `user_note`, and `next_step`.

Frontmatter is deliberately flat and JSON-compatible so the validator can reject duplicate keys, tabs, malformed values, and unsupported schemas deterministically. Free text belongs in fenced body sections and is always untrusted quoted data.
