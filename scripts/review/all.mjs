#!/usr/bin/env node
import { print } from "./common.mjs";
import { runPerformanceReview } from "./performance.mjs";
import { runReliabilityReview } from "./reliability.mjs";
import { runSecurityReview } from "./security.mjs";

const reviews = await Promise.all([
  runSecurityReview(),
  runPerformanceReview(),
  runReliabilityReview(),
]);
print({ ok: reviews.every((review) => review.ok), reviews });
