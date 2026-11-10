#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { splitFrontmatter, validateCaseRecord } from "../../../tools/contracts.mjs";

const index = process.argv.indexOf("--file");
if (index < 0 || !process.argv[index + 1]) fail("Usage: validate-case.mjs --file <case.md>");

try {
  const file = path.resolve(process.argv[index + 1]);
  const { data } = splitFrontmatter(await readFile(file, "utf8"));
  validateCaseRecord(data);
  process.stdout.write(`${JSON.stringify({ ok: true, path: file, case_id: data.case_id })}\n`);
} catch (error) {
  fail(error.message);
}

function fail(message) {
  process.stderr.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  process.exit(1);
}
