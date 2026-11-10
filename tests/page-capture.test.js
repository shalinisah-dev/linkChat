import assert from "node:assert/strict";
import test from "node:test";

import { classifyLinkedInPage } from "../src/page-capture.js";

test("capture type is inferred from LinkedIn activity URLs", () => {
  assert.equal(classifyLinkedInPage("https://www.linkedin.com/in/example-recipient/"), "profile-overview");
  assert.equal(classifyLinkedInPage("https://www.linkedin.com/in/example-recipient/recent-activity/all/"), "posts");
  assert.equal(classifyLinkedInPage("https://www.linkedin.com/in/example-recipient/recent-activity/posts/"), "posts");
  assert.equal(classifyLinkedInPage("https://www.linkedin.com/in/example-recipient/recent-activity/comments/"), "comments");
  assert.equal(classifyLinkedInPage("https://www.linkedin.com/in/example-recipient/recent-activity/reactions/"), "reactions");
});

test("unknown and non-LinkedIn pages fall back safely", () => {
  assert.equal(classifyLinkedInPage("https://example.com/in/example-recipient/recent-activity/comments/"), "profile-overview");
  assert.equal(classifyLinkedInPage("not a url"), "profile-overview");
});
