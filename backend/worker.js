import { buildDmPrompt, DM_RESPONSE_SCHEMA, parseModelJson, validateDmResult } from "../src/dm-agent.js";

const MAX_BODY_BYTES = 100_000;
const MAX_PAGE_TEXT = 20_000;

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (error) {
      return json(error.status || 500, {
        ok: false,
        code: error.code || "internal-error",
        error: error.status && error.status < 500 ? error.message : "LinkChat could not complete the request.",
      }, request, env);
    }
  },
};

async function route(request, env) {
  const origin = requireExtensionOrigin(request, env);
  if (request.method === "OPTIONS") return preflight(origin);
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/health") {
    return json(200, { ok: true, service: "linkchat-api/v1" }, request, env);
  }
  if (request.method === "POST" && url.pathname === "/v1/drafts") {
    await enforceRateLimit(request, env);
    const body = await readJson(request);
    const result = await createDraft(body, env);
    return json(200, result, request, env);
  }
  throw httpError(404, "not-found", "Unknown LinkChat route.");
}

async function createDraft(body, env) {
  const pageText = String(body?.pageText || "").slice(0, MAX_PAGE_TEXT);
  if (pageText.length < 20) throw httpError(400, "insufficient-page-context", "The LinkedIn page did not provide enough readable context.");
  if (!env.OPENAI_API_KEY || !env.OPENAI_MODEL) throw httpError(503, "service-not-configured", "LinkChat is not configured.");
  const prompt = buildDmPrompt({
    pageText,
    goal: body.goal,
    details: body.details,
    contactName: body.contactName,
    captureKind: body.captureKind,
    instructionLikeContent: Boolean(body.instructionLikeContent),
  });
  const clientRequestId = crypto.randomUUID();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
      "X-Client-Request-Id": clientRequestId,
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      store: false,
      input: prompt,
      text: { format: { type: "json_schema", name: "linkchat_dm_options", strict: true, schema: apiSchema(DM_RESPONSE_SCHEMA) } },
    }),
  });
  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) throw httpError(response.status >= 500 ? 502 : response.status, "model-request-failed", "The drafting service could not complete the request.");
  const outputText = extractOutputText(responseBody);
  const result = validateDmResult(parseModelJson(outputText), pageText);
  return {
    ok: true,
    result,
    model: env.OPENAI_MODEL,
    request_id: response.headers.get("x-request-id") || clientRequestId,
  };
}

function requireExtensionOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_EXTENSION_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!/^chrome-extension:\/\/[a-p]{32}$/.test(origin) || !allowed.includes(origin)) {
    throw httpError(403, "untrusted-origin", "This LinkChat installation is not allowed.");
  }
  return origin;
}

async function enforceRateLimit(request, env) {
  if (!env.RATE_LIMITER?.limit) throw httpError(503, "rate-limit-not-configured", "LinkChat is not configured.");
  const key = request.headers.get("X-LinkChat-Install") || "";
  if (!/^[0-9a-f-]{36}$/i.test(key)) throw httpError(400, "invalid-install-id", "This LinkChat installation is invalid.");
  const { success } = await env.RATE_LIMITER.limit({ key });
  if (!success) throw httpError(429, "rate-limit-exceeded", "You have reached the current drafting limit. Try again later.");
}

async function readJson(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) throw httpError(413, "request-too-large", "The page context is too large.");
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) throw httpError(413, "request-too-large", "The page context is too large.");
  try { return JSON.parse(text); } catch { throw httpError(400, "invalid-json", "The request was not valid JSON."); }
}

function extractOutputText(response) {
  const chunks = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) if (content?.type === "output_text" && typeof content.text === "string") chunks.push(content.text);
  }
  if (!chunks.length) throw httpError(502, "response-incomplete", "The drafting service returned no usable result.");
  return chunks.join("");
}

function apiSchema(value) {
  if (Array.isArray(value)) return value.map(apiSchema);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !["minLength", "maxLength"].includes(key)).map(([key, child]) => [key, apiSchema(child)]));
}

function preflight(origin) {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

function json(status, body, request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_EXTENSION_ORIGINS || "").split(",").map((value) => value.trim());
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (allowed.includes(origin)) Object.assign(headers, corsHeaders(origin));
  return new Response(JSON.stringify(body), { status, headers });
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-LinkChat-Install",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

export const testables = { apiSchema, extractOutputText, requireExtensionOrigin, readJson };
