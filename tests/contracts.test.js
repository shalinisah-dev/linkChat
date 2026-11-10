import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { splitFrontmatter, validateCaseRecord } from "../vault-template/tools/contracts.mjs";

const skillScripts = path.resolve("vault-template/skills/record-message-outcome/scripts");

test("case writer creates a validated immutable record", async () => {
  const vault = await mkdtemp(path.join(os.tmpdir(), "linkchat-case-"));
  const inputPath = path.join(vault, "input.json");
  await writeFile(inputPath, JSON.stringify({
    case_id: "11111111-1111-4111-8111-111111111111",
    contact_name: "Example Recipient",
    occurred_at: "2026-10-26",
    direction: "outbound",
    objective: "Request a product interview",
    lens: "plain-spoken-operator",
    outcome: "reply",
    user_rating: 4,
    recipient_axes: ["time:+1"],
    profile_version: "v2",
    exact_message: "Would a short product interview be useful?",
  }));
  const result = run("record-case.mjs", ["--vault", vault, "--input", inputPath]);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  const parsed = splitFrontmatter(await readFile(output.path, "utf8"));
  assert.doesNotThrow(() => validateCaseRecord(parsed.data));
  assert.match(parsed.body, /Would a short product interview be useful\?/);
  const duplicate = run("record-case.mjs", ["--vault", vault, "--input", inputPath]);
  assert.notEqual(duplicate.status, 0);
});

test("case retrieval has deterministic explainable ordering", async () => {
  const vault = await mkdtemp(path.join(os.tmpdir(), "linkchat-retrieve-"));
  for (const [id, lens, outcome] of [
    ["11111111-1111-4111-8111-111111111111", "voss", "reply"],
    ["22222222-2222-4222-8222-222222222222", "plain-spoken-operator", "meeting"],
  ]) {
    const input = path.join(vault, `${id}.json`);
    await writeFile(input, JSON.stringify({ case_id: id, contact_name: "Example Recipient", occurred_at: "2026-10-26", direction: "outbound", objective: "Request product interview", lens, outcome, recipient_axes: ["time:+1"], profile_version: "v1", exact_message: id }));
    assert.equal(run("record-case.mjs", ["--vault", vault, "--input", input]).status, 0);
  }
  const query = path.join(vault, "query.json");
  await writeFile(query, JSON.stringify({ contact_name: "Example Recipient", lens: "voss", objective: "product interview", recipient_axes: ["time:+1"] }));
  const result = run("retrieve-cases.mjs", ["--vault", vault, "--query", query]);
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.matches[0].lens, "voss");
  assert.ok(output.matches[0].reasons.includes("same-contact"));
});

test("capture inventory uses exact reference and category caps", async () => {
  const vault = await mkdtemp(path.join(os.tmpdir(), "linkchat-inventory-"));
  const inbox = path.join(vault, "inbox");
  await import("node:fs/promises").then(({ mkdir }) => mkdir(inbox, { recursive: true }));
  const record = (id, kind, count, contactRef = "linkedin:example-recipient") => `---\nschema: "linkchat-inbox/v1"\ncapture_id: "${id}"\ncaptured_at: "2026-10-26T00:00:00.000Z"\ncontact_name: "Example Recipient"\ncontact_ref: "${contactRef}"\nheadline: "Founder"\nrole: "CEO"\nsource_kind: "visible-page"\ncapture_kind: "${kind}"\nitem_count: ${count}\nsecurity_review: "automated-check-clean"\nsecurity_findings: []\n---\n\nquoted data\n`;
  await writeFile(path.join(inbox, "posts-1.md"), record("p1", "posts", 8));
  await writeFile(path.join(inbox, "posts-2.md"), record("p2", "posts", 8));
  await writeFile(path.join(inbox, "other.md"), record("p3", "posts", 10, "linkedin:other"));
  const script = path.resolve("vault-template/skills/form-recipient-profile/scripts/inventory-captures.mjs");
  const result = spawnSync(process.execPath, [script, "--vault", vault, "--contact-ref", "linkedin:example-recipient"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.identity_mode, "contact_ref");
  assert.equal(output.totals.posts, 10);
  assert.equal(output.selected.filter((item) => item.capture_kind === "posts").length, 2);
});

test("output boundary rejects copied capture text without echoing it", async () => {
  const vault = await mkdtemp(path.join(os.tmpdir(), "linkchat-output-boundary-"));
  const { mkdir } = await import("node:fs/promises");
  await mkdir(path.join(vault, "inbox"), { recursive: true });
  await mkdir(path.join(vault, "drafts"), { recursive: true });
  const protectedText = "Our product team studies difficult workflow transitions before proposing any new automation to customers";
  await writeFile(path.join(vault, "inbox", "capture.md"), protectedText);
  const copied = path.join(vault, "drafts", "copied.md");
  await writeFile(copied, `Analysis: ${protectedText}.`);
  const script = path.resolve("vault-template/skills/form-recipient-profile/scripts/check-output-boundary.mjs");
  const rejected = spawnSync(process.execPath, [script, "--vault", vault, "--output", copied], { encoding: "utf8" });
  assert.notEqual(rejected.status, 0);
  assert.doesNotMatch(rejected.stderr, /Our product team/);
  assert.match(rejected.stderr, /Output reproduces internal evidence/);

  const derived = path.join(vault, "drafts", "derived.md");
  await writeFile(derived, "Analysis: They appear deliberate about introducing automation during operational change.");
  const accepted = spawnSync(process.execPath, [script, "--vault", vault, "--output", derived], { encoding: "utf8" });
  assert.equal(accepted.status, 0, accepted.stderr);
});

function run(script, args) {
  return spawnSync(process.execPath, [path.join(skillScripts, script), ...args], { encoding: "utf8" });
}
