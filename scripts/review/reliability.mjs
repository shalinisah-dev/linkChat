#!/usr/bin/env node
import { stat } from "node:fs/promises";
import path from "node:path";
import { createSnapshotMarkdown } from "../../src/security.js";
import { splitFrontmatter, validateInboxRecord } from "../../vault-template/tools/contracts.mjs";
import { finding, finish, json, print, projectRoot, text } from "./common.mjs";
import { buildDmPrompt, validateDmResult } from "../../src/dm-agent.js";

export async function runReliabilityReview() {
  const findings = [];
  const manifestRoot = await json("manifest.json");
  findings.push(finding("supported-extension-baseline", Number(manifestRoot.minimum_chrome_version) >= 114, `Chrome ${manifestRoot.minimum_chrome_version}+`));
  const panel = await text("sidepanel.js");
  for (const code of ["service-not-configured", "service-unavailable", "service-timeout", "rate-limit-exceeded", "not-linkedin", "page-access-denied", "no-readable-content", "invalid-model-output", "source-overlap"]) {
    findings.push(finding(`friendly-failure:${code}`, panel.includes(code), `Explicit handling for ${code}`));
  }
  const backend = await text("backend/worker.js");
  const apiClient = await text("src/api-client.js");
  findings.push(finding("client-timeout", /AbortController/.test(apiClient) && /service-timeout/.test(apiClient), "Hosted requests have a deterministic timeout"));
  findings.push(finding("pinned-deployment-model", /!env\.OPENAI_API_KEY \|\| !env\.OPENAI_MODEL/.test(backend), "Deployment must explicitly configure a model"));
  findings.push(finding("complete-json-response", /extractOutputText/.test(backend) && /response-incomplete/.test(backend), "Missing model output fails closed"));
  findings.push(finding("bounded-request-body", /MAX_BODY_BYTES = 100_000/.test(backend) && /request-too-large/.test(backend), "Hosted request bodies are capped"));
  findings.push(finding("live-smoke-command", (await text("package.json")).includes("scripts/smoke-hosted.mjs") && (await text("scripts/smoke-hosted.mjs")).includes("Hosted smoke passed"), "Release gate calls the deployed API and validates real model output"));
  const prompt = buildDmPrompt({ pageText: "A valid professional profile with sufficient context.", goal: "mentorship" });
  findings.push(finding("bounded-prompt-context", prompt.length < 25_000, `${prompt.length} characters`));
  try {
    validateDmResult({
      recipient_analysis: "The recipient appears focused on practical, evidence-based product work.",
      approach: { id: "curious-learner", label: "Curious learner", reason: "A focused question fits this low-pressure mentorship request." },
      dm_options: [1, 2, 3].map((index) => ({ label: `Option ${index}`, text: "A concise professional message with a grounded observation and one low-pressure next step." })),
      unknowns: [],
    });
    findings.push(finding("dm-output-contract", true, "Valid three-draft result accepted"));
  } catch (error) {
    findings.push(finding("dm-output-contract", false, error.message));
  }
  const manifest = await json("vault-template/files.json");
  const unique = new Set(manifest.files);
  findings.push(finding("manifest-unique", unique.size === manifest.files.length, `${manifest.files.length} entries`));
  for (const relativePath of unique) {
    const safe = !relativePath.startsWith("/") && !relativePath.split("/").includes("..");
    const exists = safe && await stat(path.join(projectRoot, "vault-template", relativePath)).then((value) => value.isFile()).catch(() => false);
    findings.push(finding(`template:${relativePath}`, safe && exists, safe ? (exists ? "Present" : "Missing") : "Unsafe path"));
  }

  const snapshot = createSnapshotMarkdown({
    contactName: "Review Contact",
    contactRef: "linkedin:review-contact",
    headline: "Example",
    role: "Founder",
    sourceKind: "visible-page",
    captureKind: "comments",
    itemCount: 10,
    text: "A sufficiently long deterministic review snapshot.",
    findings: [],
  }, new Date("2026-01-01T00:00:00.000Z"));
  try {
    validateInboxRecord(splitFrontmatter(snapshot).data);
    const data = splitFrontmatter(snapshot).data;
    findings.push(finding("snapshot-contract", data.content_visibility === "internal-evidence-only", "Generated snapshot parses, validates, and is marked internal-only"));
  } catch (error) {
    findings.push(finding("snapshot-contract", false, error.message));
  }

  for (const skillPath of manifest.files.filter((value) => value.endsWith("/SKILL.md"))) {
    const source = await text(`vault-template/${skillPath}`);
    const header = source.match(/^---\n([\s\S]*?)\n---\n/);
    findings.push(finding(`skill-frontmatter:${skillPath}`, Boolean(header && /^name:\s*\S+/m.test(header[1]) && /^description:\s*\S+/m.test(header[1])), "Requires name and description"));
  }
  const managed = new Set(manifest.managed_files || []);
  findings.push(finding("managed-agent-rules", managed.has("AGENTS.md") && managed.has("CLAUDE.md") && managed.has("SECURITY.md"), "Critical rules update on reconnect"));
  findings.push(finding("user-memory-not-managed", !managed.has("voice/constitution.md") && !managed.has("memory/playbook.md"), "User-authored memory is never overwritten"));
  return finish("reliability", findings);
}

if (process.argv[1]?.endsWith("reliability.mjs")) print(await runReliabilityReview());
