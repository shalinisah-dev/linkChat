import assert from "node:assert/strict";
import test from "node:test";

import { createLocalDraft } from "../src/local-draft.js";

test("on-device fallback creates three grounded editable options without a service", () => {
  const pageText = "Example Recipient\nFounder building practical collaboration tools for small teams and writing about customer research.";
  const result = createLocalDraft({
    pageText,
    contactName: "Example Recipient",
    headline: "Founder building practical collaboration tools",
    goal: "partnership",
    details: "I am building a complementary product and want to compare partnership ideas",
  });
  assert.equal(result.approach.id, "strategic-collaborator");
  assert.equal(result.dm_options.length, 3);
  assert.ok(result.dm_options.every(({ text }) => text.startsWith("Hi Example")));
  assert.equal(JSON.stringify(result).includes(pageText), false);
});

test("on-device fallback is deterministic, bounded, and conservative with sparse context", () => {
  const input = { pageText: "A professional profile with little visible information.", goal: "mentorship" };
  const first = createLocalDraft(input);
  const second = createLocalDraft(input);
  assert.deepEqual(first, second);
  assert.equal(first.approach.id, "curious-learner");
  assert.match(first.recipient_analysis, /avoids making personality or private-trait inferences/i);
  assert.ok(first.dm_options.every(({ text }) => text.split(/\s+/).length <= 120));
});
