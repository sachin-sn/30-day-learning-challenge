/**
 * Part 1 — prove the fixed window's boundary flaw by actually hitting it.
 *
 * Prediction before running: 5 requests just before a 10-second window
 * boundary and 5 more just after should ALL be allowed — 10 requests in
 * about a second, against a limit that's supposed to mean "5 per 10
 * seconds" — because the two batches fall into two different, independent
 * fixed windows.
 */
import { checkFixedWindow } from "./limiters/fixedWindow";
import { runBoundaryBurst } from "./boundaryBurstHarness";
import { redis } from "./redis";

async function main() {
  const key = `demo-fixed-${Date.now()}`;
  await runBoundaryBurst(
    "fixed-window",
    (k) => checkFixedWindow(k, 5, 10),
    key,
  );
  await redis.quit();
}

main();
