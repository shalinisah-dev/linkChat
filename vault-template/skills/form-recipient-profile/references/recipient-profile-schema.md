# Recipient profile schema

Identity must include `contact_ref` when it is available (for LinkedIn, `linkedin:<public-profile-identifier>`). Treat display name as a label, not a unique key. If only a name is available, record that the match is a legacy fallback and may collide.

Write `contacts/<slug>.md` with these sections. Keep source and message content inside explicit untrusted-data fences.

```yaml
---
schema: linkchat-contact/v1
contact_name: "Display name"
headline: "Latest reviewed headline"
role: "Latest reviewed role"
profile_updated_at: "ISO-8601 timestamp"
source_capture_ids: ["UUID"]
---
```

## Professional facts

Only explicitly stated professional facts, paraphrased minimally. Include the evidence pointer for facts that may change. Do not reproduce source passages.

## Evidence inventory

Summarize available overview, post, comment, and reaction counts plus the date range. Note missing categories and ambiguous authorship.

## Recipient Read

Use a table with `axis`, `score`, `confidence`, `evidence pointers`, and `interpretation`. Allowed axes:

- orientation: analytical (-1) to relational (+1)
- status: peer-oriented (-1) to status-sensitive (+1)
- risk: risk-averse (-1) to opportunity-seeking (+1)
- motivation: purpose-driven (-1) to outcome-driven (+1)
- outreach_fatigue: open (-1) to skeptical (+1)
- time: conversational (-1) to time-poor (+1)

## Delivery dials

Record length, warmth, directness, formality, opening move, question type, and reference specificity. Each non-default setting needs an evidence pointer.

## Topics and language

Record derived recurring professional topics, language patterns, claims, and formats. Use evidence pointers only; never copy an excerpt or quotation.

## Conversation hooks

List two to five specific, non-flattering openings grounded in their work. Distinguish observations from questions.

## Contradictions and unknowns

Record conflicting evidence, weak signals, missing categories, and conclusions intentionally left unknown.

## Message history and outcomes

Preserve existing chronological entries. Each entry points to a `linkchat-case/v1` file and records date, direction, exact-text location, lens, objective, outcome, and user rating.

## Profile version notes

Append a dated note explaining material changes in evidence or confidence. Do not rewrite history to make an outcome look predictable.
