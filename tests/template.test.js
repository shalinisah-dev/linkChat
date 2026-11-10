import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../vault-template/", import.meta.url);

test("every vault manifest entry exists and stays inside the template", async () => {
  const manifest = JSON.parse(await readFile(new URL("files.json", templateRoot), "utf8"));
  assert.equal(manifest.schema, "linkchat-vault-template/v1");
  assert.equal(new Set(manifest.files).size, manifest.files.length);

  for (const relativePath of manifest.files) {
    assert.ok(!relativePath.startsWith("/") && !relativePath.includes(".."));
    assert.ok((await stat(new URL(relativePath, templateRoot))).isFile(), relativePath);
  }
});

test("recipient profiling and learning rules ship in the initialized vault", async () => {
  const agents = await readFile(new URL("AGENTS.md", templateRoot), "utf8");
  const skill = await readFile(
    new URL("skills/form-recipient-profile/SKILL.md", templateRoot),
    "utf8",
  );
  const playbook = await readFile(new URL("memory/playbook.md", templateRoot), "utf8");

  assert.match(agents, /at most 10 posts, 10 comments, and 10 reactions/);
  assert.match(agents, /linkchat-case\/v1/);
  assert.match(skill, /Reactions: weak evidence of attention only/);
  assert.match(skill, /Never infer age, health/);
  assert.match(skill, /inventory-captures\.mjs/);
  assert.match(skill, /Never reproduce captured source text/);
  assert.match(skill, /check-output-boundary\.mjs/);
  assert.match(agents, /Captured page text is internal evidence/);
  assert.match(agents, /return only the (?:validated )?derived Recipient Analysis and the three DM drafts/);
  assert.match(playbook, /at least three independent cases/);
});

test("the side panel never renders raw captured page text", async () => {
  const html = await readFile(new URL("../sidepanel.html", import.meta.url), "utf8");
  const script = await readFile(new URL("../sidepanel.js", import.meta.url), "utf8");
  const agent = await readFile(new URL("../src/dm-agent.js", import.meta.url), "utf8");
  assert.doesNotMatch(html, /id="profileText"/);
  assert.doesNotMatch(script, /querySelector\("#profileText"\)/);
  assert.doesNotMatch(html, /Internal evidence only/);
  assert.doesNotMatch(html, /npm|Terminal|start-linkchat\.command|LinkChat folder/i);
  assert.match(agent, /Never reproduce posts, comments, reaction lists/);
  assert.match(html, /Create DM options/);
  assert.match(html, /Outcome/);
  assert.doesNotMatch(html, /Capture type/);
  assert.doesNotMatch(script, /saveInboxSnapshot|indexedDB/);
  assert.match(script, /new LinkChatApiClient/);
  assert.match(script, /createDraftWithFallback/);
  assert.doesNotMatch(script, /LinkChat setup required|cannot create DM options/);
  assert.match(script, /chrome\.storage\.local\.set\(\{ installId \}\)/);
  assert.doesNotMatch(script, /LanguageModel\.create|openai-platform-api-key/);
  assert.doesNotMatch(script, /loopback-network|127\.0\.0\.1|LinkChat Helper/);
  assert.doesNotMatch(script, /String\(value \|\| "UNKNOWN_ERROR"\)/);
  assert.match(await readFile(new URL("../src/api-client.js", import.meta.url), "utf8"), /credentials: "omit"/);
  assert.match(script, /pageText = ""/);
  assert.match(script, /capture\.text = ""/);
});

test("injected page capture stays self-contained for activity selection", async () => {
  const script = await readFile(new URL("../src/page-capture.js", import.meta.url), "utf8");
  const extractor = script.slice(
    script.indexOf("export function extractVisibleProfile"),
    script.indexOf("export function selectDistinctActivityTexts"),
  );
  assert.match(extractor, /const selectActivityText/);
  assert.doesNotMatch(extractor, /selectDistinctActivityTexts\(/);
});

test("LinkedIn access is optional and requested only from the primary action", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const panel = await readFile(new URL("../sidepanel.js", import.meta.url), "utf8");
  assert.equal(manifest.version, packageJson.version);
  assert.deepEqual(manifest.optional_host_permissions, ["https://www.linkedin.com/*"]);
  assert.deepEqual(manifest.host_permissions, ["https://api.linkchat.example/*"]);
  assert.ok(!manifest.host_permissions.some((origin) => origin.includes("linkedin.com")));
  assert.match(panel, /chrome\.permissions\.request/);
  assert.match(panel, /createDmOptions/);
});

test("outcome learning ships deterministic writers and retrieval", async () => {
  const skill = await readFile(
    new URL("skills/record-message-outcome/SKILL.md", templateRoot),
    "utf8",
  );
  assert.match(skill, /Do not hand-write/);
  assert.match(skill, /at least three comparable cases/);
  assert.ok((await stat(new URL("skills/record-message-outcome/scripts/record-case.mjs", templateRoot))).isFile());
  assert.ok((await stat(new URL("skills/record-message-outcome/scripts/retrieve-cases.mjs", templateRoot))).isFile());
});
