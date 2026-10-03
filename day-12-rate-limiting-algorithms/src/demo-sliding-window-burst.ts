/**
 * Part 2 — the exact same burst pattern as Part 1, against the sliding
 * window log instead.
 *
 * Prediction before running: only 5 of the 10 requests should be
 * allowed, regardless of which side of the boundary they landed on —
 * because "the last 10 seconds" is measured from each request's own
 * clock time, not from a calendar-aligned window, so there's no boundary
 * for this burst to exploit.
 */
import { checkSlidingWindowLog } from "./limiters/slidingWindowLog";
import { runBoundaryBurst } from "./boundaryBurstHarness";
import { redis } from "./redis";

async function main() {
  const key = `demo-sliding-${Date.now()}`;
  await runBoundaryBurst("sliding-window", (k) => checkSlidingWindowLog(k, 5, 10), key);
  await redis.quit();
}

main();
