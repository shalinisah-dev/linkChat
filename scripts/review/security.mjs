#!/usr/bin/env node
import { filesIn, finding, finish, json, print, text } from "./common.mjs";

export async function runSecurityReview() {
  const findings = [];
  const manifest = await json("manifest.json");
  const vaultManifest = await json("vault-template/files.json");
  const permissions = [...(manifest.permissions || [])].sort();
  const expected = ["scripting", "sidePanel", "storage"].sort();
  findings.push(finding("least-privilege-permissions", JSON.stringify(permissions) === JSON.stringify(expected), permissions.join(", ")));
  findings.push(finding(
    "fixed-https-api-permission",
    (manifest.host_permissions || []).length === 1 && /^https:\/\/[^*]+\/\*$/.test(manifest.host_permissions[0]) && !manifest.content_scripts,
    "Persistent network access is limited to one HTTPS API origin",
  ));
  findings.push(finding(
    "linkedin-only-optional-access",
    JSON.stringify(manifest.optional_host_permissions || []) === JSON.stringify(["https://www.linkedin.com/*"]),
    "Optional site access is limited to linkedin.com",
  ));
  findings.push(finding("supported-extension-baseline", Number(manifest.minimum_chrome_version) >= 114, `Minimum Chrome ${manifest.minimum_chrome_version}`));

  const executableFiles = [
    "service-worker.js",
    "sidepanel.js",
    ...(await filesIn("src", ".js")),
    ...vaultManifest.files.filter((value) => value.endsWith(".mjs")).map((value) => `vault-template/${value}`),
  ];
  const forbidden = [
    ["eval", /\beval\s*\(/],
    ["function-constructor", /\bnew\s+Function\b/],
    ["html-injection", /\.innerHTML\s*=/],
    ["openai-secret-in-extension", /OPENAI_API_KEY|openai-platform-api-key/],
  ];
  for (const file of executableFiles) {
    const source = (await text(file)).replaceAll('"https://www.linkedin.com/*"', '"LINKEDIN_OPTIONAL_ORIGIN"');
    for (const [rule, pattern] of forbidden) {
      findings.push(finding(`${file}:${rule}`, !pattern.test(source), pattern.test(source) ? "Forbidden construct found" : "Clean"));
    }
  }

  const sidepanel = (await text("sidepanel.html")).toLowerCase();
  const panelScript = await text("sidepanel.js");
  const agent = await text("src/dm-agent.js");
  const backend = await text("backend/worker.js");
  findings.push(finding("truthful-processing-disclosure", sidepanel.includes("processed to create this draft") && sidepanel.includes("not saved by linkchat"), "UI states remote processing and retention accurately"));
  findings.push(finding("no-persistent-profile-write", !/saveInboxSnapshot|indexedDB|showDirectoryPicker|storage\.local\.(?:set|setAccessLevel).*pageText/.test(panelScript), "Only a random installation ID is persisted; captured profile data is not"));
  findings.push(finding("transient-source-cleared", /pageText = ""/.test(panelScript) && /capture\.text = ""/.test(panelScript), "Captured text variables are cleared in cleanup"));
  findings.push(finding("no-secret-in-extension", !/OPENAI_API_KEY|Authorization:\s*`Bearer/.test(panelScript), "Model credentials are absent from browser code"));
  findings.push(finding("trusted-extension-origin", backend.includes('^chrome-extension:\\/\\/[a-p]{32}$') && backend.includes("untrusted-origin"), "Hosted API rejects untrusted browser origins"));
  findings.push(finding("rate-limit-fail-closed", /rate-limit-not-configured/.test(backend) && /RATE_LIMITER\.limit/.test(backend), "Drafting fails closed without abuse controls"));
  findings.push(finding("bounded-backend-body", /MAX_BODY_BYTES = 100_000/.test(backend) && /request-too-large/.test(backend), "Hosted request bodies are capped"));
  findings.push(finding("no-api-retention-request", /store: false/.test(backend), "Responses requests disable API storage"));
  findings.push(finding("structured-output-constraint", /strict: true/.test(backend) && /DM_RESPONSE_SCHEMA/.test(backend), "Model output is schema constrained"));
  findings.push(finding("source-overlap-guard", /hasLongSourceOverlap/.test(agent), "Derived output is checked against verbatim source overlap"));
  findings.push(finding("no-raw-capture-output", !sidepanel.includes('id="profiletext"') && !sidepanel.includes("visible profile text"), "Side panel does not render captured source text"));
  const rules = `${await text("vault-template/AGENTS.md")}\n${await text("vault-template/SECURITY.md")}`.toLowerCase();
  findings.push(finding("untrusted-capture-policy", rules.includes("untrusted") && rules.includes("quarantine"), "Vault rules require untrusted-data handling and quarantine"));
  findings.push(finding("internal-evidence-output-policy", rules.includes("internal evidence") && rules.includes("never reproduce") && rules.includes("recipient analysis"), "Agent rules restrict results to derived analysis and drafts"));
  return finish("privacy-security", findings);
}

if (process.argv[1]?.endsWith("security.mjs")) print(await runSecurityReview());
