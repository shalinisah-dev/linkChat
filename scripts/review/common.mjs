import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export async function text(relativePath) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

export async function json(relativePath) {
  return JSON.parse(await text(relativePath));
}

export async function filesIn(relativeDirectory, suffix = "") {
  const directory = path.join(projectRoot, relativeDirectory);
  return (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
    .map((entry) => path.join(relativeDirectory, entry.name))
    .sort();
}

export function finding(id, passed, detail) {
  return { id, status: passed ? "pass" : "fail", detail };
}

export function finish(name, findings) {
  const failed = findings.filter((item) => item.status === "fail").length;
  return { name, ok: failed === 0, failed, findings };
}

export function print(report) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ok) process.exitCode = 1;
}
