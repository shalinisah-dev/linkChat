import { randomUUID } from "node:crypto";

export const CASE_OUTCOMES = new Set([
  "reply",
  "no-reply",
  "meeting",
  "referral",
  "declined",
  "ongoing",
  "unknown",
]);

export function splitFrontmatter(markdown) {
  if (!markdown.startsWith("---\n")) throw new Error("Missing opening frontmatter delimiter");
  const end = markdown.indexOf("\n---\n", 4);
  if (end < 0) throw new Error("Missing closing frontmatter delimiter");
  const source = markdown.slice(4, end);
  if (source.includes("\t")) throw new Error("Tabs are forbidden in YAML frontmatter");
  const data = {};
  for (const [index, line] of source.split("\n").entries()) {
    if (!line.trim()) continue;
    const match = line.match(/^([a-z][a-z0-9_]*)\s*:\s*(.*)$/);
    if (!match) throw new Error(`Invalid frontmatter line ${index + 1}: ${line}`);
    if (Object.hasOwn(data, match[1])) throw new Error(`Duplicate frontmatter key: ${match[1]}`);
    data[match[1]] = parseValue(match[2]);
  }
  return { data, body: markdown.slice(end + 5) };
}

export function serializeFrontmatter(entries) {
  const lines = entries.map(([key, value]) => {
    if (!/^[a-z][a-z0-9_]*$/.test(key)) throw new Error(`Invalid frontmatter key: ${key}`);
    return `${key}: ${JSON.stringify(value)}`;
  });
  return `---\n${lines.join("\n")}\n---\n`;
}

export function validateInboxRecord(data) {
  requireKeys(data, [
    "schema",
    "capture_id",
    "captured_at",
    "contact_name",
    "headline",
    "role",
    "source_kind",
    "capture_kind",
    "item_count",
    "security_review",
    "security_findings",
  ]);
  if (data.schema !== "linkchat-inbox/v1") throw new Error(`Unsupported inbox schema: ${data.schema}`);
  if (Object.hasOwn(data, "content_visibility") && data.content_visibility !== "internal-evidence-only") {
    throw new Error("content_visibility must be internal-evidence-only");
  }
  if (Object.hasOwn(data, "contact_ref") && typeof data.contact_ref !== "string") {
    throw new Error("contact_ref must be a string when present");
  }
  if (!Number.isInteger(data.item_count) || data.item_count < 0 || data.item_count > 10) {
    throw new Error("item_count must be an integer from 0 to 10");
  }
  if (!Array.isArray(data.security_findings)) throw new Error("security_findings must be an array");
  return data;
}

export function validateCaseRecord(data) {
  requireKeys(data, [
    "schema",
    "case_id",
    "contact_slug",
    "occurred_at",
    "direction",
    "objective",
    "lens",
    "outcome",
    "evaluation_window_days",
    "user_rating",
    "recipient_axes",
    "profile_version",
  ]);
  if (data.schema !== "linkchat-case/v1") throw new Error(`Unsupported case schema: ${data.schema}`);
  if (!/^[0-9a-f-]{36}$/i.test(data.case_id)) throw new Error("case_id must be a UUID");
  if (!new Set(["outbound", "inbound"]).has(data.direction)) throw new Error("direction is invalid");
  if (!CASE_OUTCOMES.has(data.outcome)) throw new Error("outcome is invalid");
  if (data.outcome === "no-reply" && (!Number.isInteger(data.evaluation_window_days) || data.evaluation_window_days < 1)) {
    throw new Error("no-reply requires a positive evaluation_window_days");
  }
  if (data.user_rating !== null && (!Number.isInteger(data.user_rating) || data.user_rating < 1 || data.user_rating > 5)) {
    throw new Error("user_rating must be null or an integer from 1 to 5");
  }
  if (!Array.isArray(data.recipient_axes)) throw new Error("recipient_axes must be an array");
  return data;
}

export function normalizeCaseInput(input) {
  const contactSlug = safeSlug(input.contact_slug || input.contact_name);
  const occurredAt = String(input.occurred_at || "");
  if (!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(occurredAt)) throw new Error("occurred_at must be an ISO date or timestamp");
  if (!String(input.exact_message || "").trim()) throw new Error("exact_message is required");
  const data = {
    schema: "linkchat-case/v1",
    case_id: input.case_id || randomUUID(),
    contact_slug: contactSlug,
    occurred_at: occurredAt,
    direction: input.direction,
    objective: String(input.objective || "").trim(),
    lens: String(input.lens || "unknown").trim() || "unknown",
    outcome: input.outcome,
    evaluation_window_days: input.evaluation_window_days ?? null,
    user_rating: input.user_rating ?? null,
    recipient_axes: Array.isArray(input.recipient_axes) ? input.recipient_axes.map(String) : [],
    profile_version: String(input.profile_version || "unknown"),
  };
  if (!data.objective) throw new Error("objective is required");
  validateCaseRecord(data);
  return data;
}

export function safeSlug(value) {
  const slug = String(value || "contact")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || "contact";
}

export function chooseFence(text) {
  const longest = (String(text).match(/~+/g) || []).reduce((max, value) => Math.max(max, value.length), 0);
  return "~".repeat(Math.max(3, longest + 1));
}

function parseValue(source) {
  if (/^(?:"|\[|\{|null$|true$|false$|-?\d)/.test(source)) {
    try {
      return JSON.parse(source);
    } catch (error) {
      throw new Error(`Invalid JSON-compatible YAML value: ${source}`, { cause: error });
    }
  }
  if (/^[A-Za-z0-9._/-]+$/.test(source)) return source;
  throw new Error(`Frontmatter values must be JSON-compatible or a plain token: ${source}`);
}

function requireKeys(data, keys) {
  for (const key of keys) if (!Object.hasOwn(data, key)) throw new Error(`Missing required key: ${key}`);
}
