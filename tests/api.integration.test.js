import assert from "node:assert/strict";
import test from "node:test";

import worker, { testables } from "../backend/worker.js";
import { LinkChatApiClient } from "../src/api-client.js";
import { DM_RESPONSE_SCHEMA } from "../src/dm-agent.js";

const extensionOrigin = "chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

test("hosted functional flow returns validated drafts without API storage", async (context) => {
  const originalFetch = globalThis.fetch;
  let openAiRequest;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    openAiRequest = JSON.parse(init.body);
    assert.equal(init.headers.Authorization, "Bearer server-secret");
    return new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: JSON.stringify(validDmResult()) }] }] }), {
      status: 200,
      headers: { "Content-Type": "application/json", "x-request-id": "req_hosted_test" },
    });
  };
  context.after(() => { globalThis.fetch = originalFetch; });
  const env = testEnv();
  const serviceFetch = async (url, init = {}) => worker.fetch(new Request(url, {
    ...init,
    headers: { ...(init.headers || {}), Origin: extensionOrigin, "CF-Connecting-IP": "203.0.113.10" },
  }), env);
  const client = new LinkChatApiClient({ baseUrl: "https://api.linkchat.test", fetchImpl: serviceFetch, clientIdProvider: async () => "00000000-0000-4000-8000-000000000001" });
  const response = await client.draft({
    pageText: "Synthetic fixture: Example Recipient builds practical product systems and writes sample posts about customer research, careful experimentation, and respectful partnerships.",
    goal: "partnership",
    details: "Explore a startup partnership",
    contactName: "Example Recipient",
    captureKind: "profile-overview",
  });
  assert.equal(response.result.dm_options.length, 3);
  assert.equal(response.request_id, "req_hosted_test");
  assert.equal(openAiRequest.store, false);
  assert.equal(openAiRequest.text.format.type, "json_schema");
  assert.equal(openAiRequest.text.format.strict, true);
});

test("hosted API rejects untrusted origins before inference", async () => {
  const env = testEnv();
  const response = await worker.fetch(new Request("https://api.linkchat.test/v1/drafts", {
    method: "POST",
    headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
    body: JSON.stringify({ pageText: "Sufficient profile text for a request." }),
  }), env);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "untrusted-origin");
});

test("hosted API fails closed when rate limiting is unavailable", async () => {
  const env = testEnv();
  delete env.RATE_LIMITER;
  const response = await worker.fetch(new Request("https://api.linkchat.test/v1/drafts", {
    method: "POST",
    headers: { Origin: extensionOrigin, "Content-Type": "application/json", "X-LinkChat-Install": "00000000-0000-4000-8000-000000000001" },
    body: JSON.stringify({ pageText: "Sufficient profile text for a request." }),
  }), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "rate-limit-not-configured");
});

test("client reports deterministic configuration and structured errors", async () => {
  const unconfigured = new LinkChatApiClient();
  assert.equal(unconfigured.isConfigured(), false);
  await assert.rejects(unconfigured.draft({}), { code: "service-not-configured" });
  const client = new LinkChatApiClient({
    baseUrl: "https://api.linkchat.test",
    clientIdProvider: async () => "00000000-0000-4000-8000-000000000001",
    fetchImpl: async () => new Response(JSON.stringify({ code: { code: "nested-code" }, error: { message: "Readable failure" } }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    }),
  });
  assert.equal(client.isConfigured(), true);
  await assert.rejects(client.draft({}), (error) => error.code === "nested-code" && error.message === "Readable failure" && !error.message.includes("[object Object]"));
});

test("API schema keeps strict structure and removes unsupported length keywords", () => {
  const schema = testables.apiSchema(DM_RESPONSE_SCHEMA);
  assert.equal(JSON.stringify(schema).includes("minLength"), false);
  assert.equal(JSON.stringify(schema).includes("maxLength"), false);
  assert.equal(schema.additionalProperties, false);
});

function testEnv() {
  return {
    ALLOWED_EXTENSION_ORIGINS: extensionOrigin,
    OPENAI_API_KEY: "server-secret",
    OPENAI_MODEL: "test-model-2026-01-01",
    RATE_LIMITER: { limit: async () => ({ success: true }) },
  };
}

function validDmResult() {
  return {
    recipient_analysis: "This recipient appears to value practical product work, careful research, and grounded collaboration.",
    approach: { id: "strategic-collaborator", label: "Strategic collaborator", reason: "A concrete mutual-fit frame matches the partnership outcome without assuming interest." },
    dm_options: [
      { label: "Direct", text: "Hi Example — your practical approach to product research stood out. I’m building in an adjacent area and see a possible partnership worth pressure-testing. Would you be open to a brief conversation next week?" },
      { label: "Warm", text: "Hi Example, I appreciated how grounded your product work appears to be. I’m exploring a startup partnership that may connect with your focus, and I’d value a short conversation to see whether there is genuine fit." },
      { label: "Concise", text: "Hi Example — I’m building a startup in a related space and believe there may be a useful partnership angle. Would you be open to a short call to compare what each of us is working on?" },
    ],
    unknowns: ["Whether partnership conversations are currently a priority"],
  };
}
