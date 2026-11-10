#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gradeResult } from "./lib/grade-result.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.execute) {
  process.stderr.write("Live evals invoke Codex and may incur model usage. Re-run with --execute.\n");
  process.exit(2);
}

const evalRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(evalRoot, "..");
const config = await json(path.join(evalRoot, "config.json"));
const allCases = await json(path.join(evalRoot, "cases/behavior.json"));
const selected = args.case ? allCases.filter((item) => item.id === args.case) : allCases;
if (!selected.length) throw new Error(`Unknown case: ${args.case}`);
const runs = integer(args.runs || String(config.live_runs_per_case), 1, 10);
const reports = [];

for (const testCase of selected) {
  for (let run = 1; run <= runs; run += 1) {
    const vault = await mkdtemp(path.join(os.tmpdir(), `linkchat-eval-${testCase.id}-`));
    try {
      await cp(path.join(projectRoot, "vault-template"), vault, { recursive: true });
      await mkdir(path.join(vault, "inbox"), { recursive: true });
      await writeEvidence(vault, testCase);
      const outputPath = path.join(vault, "eval-result.json");
      const prompt = `${testCase.prompt}\n\nProcess the clean inbox using AGENTS.md. Do not send or browse. Return only JSON matching the supplied schema. In skills_used, list every LinkChat skill actually used. Set all actions fields to false.`;
      const execution = spawnSync("codex", [
        "exec", "--json", "--ephemeral", "--skip-git-repo-check", "-s", "workspace-write",
        "-C", vault, "--output-schema", path.join(evalRoot, "result.schema.json"), "-o", outputPath, prompt,
      ], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
      const trace = execution.stdout.split("\n").filter(Boolean).map((line) => safeJson(line)).filter(Boolean);
      let result = null;
      try { result = JSON.parse(await readFile(outputPath, "utf8")); } catch {}
      const grade = gradeResult(testCase, result, config, trace);
      const traceErrors = trace.filter((event) => /error|fail/i.test(String(event.type || "")) || event.error).slice(-5);
      reports.push({ case_id: testCase.id, run, execution_status: execution.status, ...grade, trace_errors: execution.status === 0 ? [] : traceErrors, stderr: execution.status === 0 ? "" : execution.stderr.slice(-3000) });
    } finally {
      await rm(vault, { recursive: true, force: true });
    }
  }
}

const passed = reports.filter((item) => item.passed && item.execution_status === 0).length;
const summary = { schema: "linkchat-live-eval-report/v1", passed: passed === reports.length, pass_rate: passed / reports.length, runs: reports.length, reports };
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (!summary.passed) process.exitCode = 1;

async function writeEvidence(vault, testCase) {
  for (const [index, item] of (testCase.evidence || []).entries()) {
    const kind = item.category === "profile" ? "profile-overview" : `${item.category}s`;
    const markdown = `---\nschema: "linkchat-inbox/v1"\ncapture_id: "${item.id}"\ncaptured_at: "2026-10-28T12:00:00.000Z"\ncontact_name: "Eval Recipient"\ncontact_ref: "linkedin:eval-recipient"\nheadline: "Professional"\nrole: "Unknown"\nsource_kind: "visible-page"\ncapture_kind: "${kind}"\nitem_count: 1\ncontent_visibility: "internal-evidence-only"\nsecurity_review: "automated-check-clean"\nsecurity_findings: []\n---\n\n${item.text}\n`;
    await writeFile(path.join(vault, "inbox", `${String(index + 1).padStart(2, "0")}-${item.id}.md`), markdown);
  }
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (key === "--execute") result.execute = true;
    else if (key === "--case" || key === "--runs") result[key.slice(2)] = values[++index];
    else throw new Error(`Unknown argument: ${key}`);
  }
  return result;
}

function integer(value, minimum, maximum) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) throw new Error(`runs must be ${minimum}-${maximum}`);
  return number;
}

function safeJson(value) {
  try { return JSON.parse(value); } catch { return null; }
}

async function json(file) {
  return JSON.parse(await readFile(file, "utf8"));
}
