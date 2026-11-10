#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import { analyzeUntrustedText } from "../../src/security.js";
import { validateDmResult } from "../../src/dm-agent.js";
import { selectDistinctActivityTexts } from "../../src/page-capture.js";
import { finding, finish, print } from "./common.mjs";

export async function runPerformanceReview() {
  const findings = [];
  const payload = "Professional profile text and product notes. ".repeat(500).slice(0, 20_000);
  const securityMs = benchmark(() => analyzeUntrustedText(payload), 500);
  findings.push(finding("security-scan-average-under-5ms", securityMs < 5, `${securityMs.toFixed(3)}ms average`));

  const candidates = Array.from({ length: 5_000 }, (_, index) => `Activity item ${index} ${"x".repeat(40)}`);
  const activityMs = benchmark(() => {
    let selected = [];
    for (const candidate of candidates) {
      selected = selectDistinctActivityTexts(selected, candidate, 10);
      if (selected.length === 10) break;
    }
    if (selected.length !== 10) throw new Error("Activity selection did not enforce the cap");
  }, 500);
  findings.push(finding("activity-selection-average-under-2ms", activityMs < 2, `${activityMs.toFixed(3)}ms average for a 5,000-item source`));
  findings.push(finding("activity-card-cap", selectDistinctActivityTexts([], "x".repeat(30), 10).length === 1, "Selector accepts valid cards and enforces its explicit cap"));
  const result = {
    recipient_analysis: "A grounded recipient analysis that is long enough for validation.",
    approach: { id: "direct-operator", label: "Direct operator", reason: "The concrete outcome benefits from clarity and respect for time." },
    dm_options: [1, 2, 3].map((index) => ({ label: `Option ${index}`, text: "A concise professional message with a relevant observation and a low-pressure next step for the recipient." })),
    unknowns: [],
  };
  const validationMs = benchmark(() => validateDmResult(result, payload), 500);
  findings.push(finding("output-validation-average-under-5ms", validationMs < 5, `${validationMs.toFixed(3)}ms average`));
  return finish("performance", findings);
}

function benchmark(operation, iterations) {
  for (let index = 0; index < 20; index += 1) operation();
  const start = performance.now();
  for (let index = 0; index < iterations; index += 1) operation();
  return (performance.now() - start) / iterations;
}

if (process.argv[1]?.endsWith("performance.mjs")) print(await runPerformanceReview());
