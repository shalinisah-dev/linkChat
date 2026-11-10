#!/usr/bin/env node
import { validateDmResult } from "../src/dm-agent.js";

const baseUrl = String(process.env.LINKCHAT_API_BASE_URL || "").replace(/\/$/, "");
const extensionOrigin = process.env.LINKCHAT_EXTENSION_ORIGIN || "";
if (!/^https:\/\//.test(baseUrl) || !/^chrome-extension:\/\/[a-p]{32}$/.test(extensionOrigin)) {
  throw new Error("Set LINKCHAT_API_BASE_URL and LINKCHAT_EXTENSION_ORIGIN for the deployed release candidate.");
}

const response = await fetch(`${baseUrl}/v1/drafts`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: extensionOrigin, "X-LinkChat-Install": crypto.randomUUID() },
  body: JSON.stringify({
    pageText: "Synthetic test fixture: Example Recipient is a product leader building collaboration tools for small teams. Their sample posts emphasize careful customer research, practical experiments, and respectful partnerships.",
    goal: "partnership",
    details: "Explore a possible startup partnership without making assumptions.",
    contactName: "Example Recipient",
    captureKind: "profile-overview",
  }),
});
const body = await response.json().catch(() => ({}));
if (!response.ok) throw new Error(`Hosted smoke failed: ${body.code || response.status}`);
validateDmResult(body.result);
if (!body.request_id) throw new Error("Hosted smoke response did not include a request ID.");
process.stdout.write(`Hosted smoke passed (${body.request_id}).\n`);
