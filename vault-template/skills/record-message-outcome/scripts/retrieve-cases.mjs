#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { safeSlug, splitFrontmatter, validateCaseRecord } from "../../../tools/contracts.mjs";

const args = parseArgs(process.argv.slice(2));
if (!args.query) fail("Usage: retrieve-cases.mjs --query <json-file> [--vault <path>] [--limit 10]");

try {
  const query = JSON.parse(await readFile(path.resolve(args.query), "utf8"));
  const limit = integerInRange(args.limit ?? "10", 1, 50, "limit");
  const directory = path.resolve(args.vault || ".", "memory/cases");
  const names = await readdir(directory).catch((error) => (error.code === "ENOENT" ? [] : Promise.reject(error)));
  const ranked = [];
  for (const name of names.filter((value) => value.endsWith(".md") && !value.startsWith("_"))) {
    const file = path.join(directory, name);
    try {
      const { data } = splitFrontmatter(await readFile(file, "utf8"));
      validateCaseRecord(data);
      ranked.push({ ...rank(data, query), path: file, case: data });
    } catch (error) {
      ranked.push({ invalid: true, path: file, error: error.message });
    }
  }
  const invalid = ranked.filter((item) => item.invalid);
  const matches = ranked
    .filter((item) => !item.invalid && item.score > 0)
    .sort((a, b) => b.score - a.score || b.case.occurred_at.localeCompare(a.case.occurred_at) || a.case.case_id.localeCompare(b.case.case_id))
    .slice(0, limit)
    .map(({ path: file, score, reasons, case: data }) => ({
      path: file,
      score,
      reasons,
      case_id: data.case_id,
      occurred_at: data.occurred_at,
      contact_slug: data.contact_slug,
      objective: data.objective,
      lens: data.lens,
      outcome: data.outcome,
      recipient_axes: data.recipient_axes,
    }));
  process.stdout.write(`${JSON.stringify({ ok: true, matches, invalid }, null, 2)}\n`);
} catch (error) {
  fail(error.message);
}

function rank(data, query) {
  let score = 0;
  const reasons = [];
  const contact = query.contact_slug || query.contact_name;
  if (contact && data.contact_slug === safeSlug(contact)) add(100, "same-contact");
  if (query.lens && normalize(query.lens) === normalize(data.lens)) add(20, "same-lens");
  const overlap = [...tokens(query.objective)].filter((token) => tokens(data.objective).has(token)).length;
  if (overlap) add(Math.min(overlap * 5, 30), `objective-token-overlap:${overlap}`);
  const axes = new Set((query.recipient_axes || []).map(normalize));
  const sharedAxes = data.recipient_axes.filter((axis) => axes.has(normalize(axis))).length;
  if (sharedAxes) add(sharedAxes * 10, `shared-axes:${sharedAxes}`);
  if (query.outcome && query.outcome === data.outcome) add(5, "same-outcome");
  return { score, reasons };

  function add(points, reason) {
    score += points;
    reasons.push(reason);
  }
}

function tokens(value) {
  return new Set(normalize(value).split(/[^a-z0-9]+/).filter((token) => token.length >= 3));
}

function normalize(value) {
  return String(value || "").toLowerCase().trim();
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
