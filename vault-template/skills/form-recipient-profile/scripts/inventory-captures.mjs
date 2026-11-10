#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { splitFrontmatter, validateInboxRecord } from "../../../tools/contracts.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args["contact-ref"] && !args["contact-name"]) {
  fail("Usage: inventory-captures.mjs --vault <path> (--contact-ref <ref> | --contact-name <name>)");
}

try {
  const vault = path.resolve(args.vault || ".");
  const files = [
    ...(await markdownFiles(path.join(vault, "inbox"))),
    ...(await markdownFiles(path.join(vault, "inbox/processed"))),
  ];
  const records = [];
  const invalid = [];
  for (const file of [...new Set(files)].sort()) {
    try {
      const { data } = splitFrontmatter(await readFile(file, "utf8"));
      validateInboxRecord(data);
      if (matches(data, args)) records.push({ path: file, ...data });
    } catch (error) {
      invalid.push({ path: file, error: error.message });
    }
  }
  records.sort((a, b) => b.captured_at.localeCompare(a.captured_at) || a.capture_id.localeCompare(b.capture_id));
  const selected = [];
  const totals = { posts: 0, comments: 0, reactions: 0 };
  const overview = records.find((record) => record.capture_kind === "profile-overview");
  if (overview) selected.push(summarize(overview));
  for (const category of Object.keys(totals)) {
    for (const record of records.filter((item) => item.capture_kind === category)) {
      if (totals[category] >= 10) break;
      const includedItems = Math.min(record.item_count, 10 - totals[category]);
      if (includedItems < 1) continue;
      totals[category] += includedItems;
      selected.push({ ...summarize(record), included_items: includedItems });
    }
  }
  process.stdout.write(`${JSON.stringify({
    ok: true,
    identity_mode: args["contact-ref"] ? "contact_ref" : "legacy-normalized-name",
    selected,
    totals,
    invalid,
  }, null, 2)}\n`);
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

function matches(data, query) {
  if (query["contact-ref"]) return data.contact_ref === query["contact-ref"];
  return normalizeName(data.contact_name) === normalizeName(query["contact-name"]);
}

function normalizeName(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("en-US").replace(/\s+/g, " ").trim();
}

function summarize(record) {
  return {
    path: record.path,
    capture_id: record.capture_id,
    captured_at: record.captured_at,
    capture_kind: record.capture_kind,
    item_count: record.item_count,
    security_review: record.security_review,
  };
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
