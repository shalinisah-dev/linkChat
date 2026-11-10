#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
if (!args.output) fail("Usage: check-output-boundary.mjs --vault <path> --output <analysis-or-draft.md> [--window 12]");

try {
  const vault = path.resolve(args.vault || ".");
  const outputPath = path.resolve(args.output);
  const windowSize = integerInRange(args.window || "12", 8, 30, "window");
  const outputTokens = tokenize(await readFile(outputPath, "utf8"));
  const outputWindows = windows(outputTokens, windowSize);
  const evidenceFiles = [
    ...(await markdownFiles(path.join(vault, "inbox"))),
    ...(await markdownFiles(path.join(vault, "inbox/processed"))),
  ];
  const overlaps = [];
  for (const file of [...new Set(evidenceFiles)].sort()) {
    if (path.resolve(file) === outputPath) continue;
    const evidenceWindows = windows(tokenize(await readFile(file, "utf8")), windowSize);
    if ([...outputWindows].some((value) => evidenceWindows.has(value))) {
      overlaps.push({ evidence_path: file, matched_window_words: windowSize });
    }
  }
  if (overlaps.length) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: "Output reproduces internal evidence", output: outputPath, overlaps }, null, 2)}\n`);
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify({ ok: true, output: outputPath, checked_evidence_files: evidenceFiles.length, window_words: windowSize })}\n`);
} catch (error) {
  fail(error.message);
}

async function markdownFiles(directory) {
  try {
    return (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md") && !entry.name.startsWith("_"))
      .map((entry) => path.join(directory, entry.name));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function tokenize(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .match(/[\p{L}\p{N}]+/gu) || [];
}

function windows(tokens, size) {
  const result = new Set();
  for (let index = 0; index + size <= tokens.length; index += 1) {
    result.add(tokens.slice(index, index + size).join(" "));
  }
  return result;
}

function integerInRange(value, minimum, maximum, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < minimum || number > maximum) throw new Error(`${label} must be ${minimum}-${maximum}`);
  return number;
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    if (!key?.startsWith("--") || values[index + 1] === undefined) fail(`Invalid argument: ${key || "(missing)"}`);
    result[key.slice(2)] = values[index + 1];
  }
  return result;
}

function fail(message) {
  process.stderr.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  process.exit(1);
}
