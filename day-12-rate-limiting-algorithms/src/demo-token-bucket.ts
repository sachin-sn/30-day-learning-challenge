/**
 * Part 3 — token bucket: burst up to capacity, then throttle to the
 * refill rate.
 *
 * Capacity 5, refill 1 token every 2 seconds (0.5/sec). Prediction before
 * running: the first 5 requests fire immediately and should ALL be
 * allowed (draining the bucket from full). A 6th request fired right
 * after should be DENIED (no tokens left). Waiting ~2.2s should refill
 * about 1 token, allowing exactly one more request before denying again.
 */
import { checkTokenBucket } from "./limiters/tokenBucket";
import { redis } from "./redis";

const CAPACITY = 5;
const REFILL_PER_SECOND = 0.5; // 1 token every 2 seconds

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ts(): string {
  return new Date().toISOString().slice(11, 23);
}

async function fire(key: string, label: string) {
  const result = await checkTokenBucket(key, CAPACITY, REFILL_PER_SECOND);
  console.log(
    `${ts()} ${label} -> ${result.allowed ? "ALLOWED" : "DENIED "} ` +
      `(tokens remaining: ${result.tokensRemaining.toFixed(2)})`,
  );
  return result.allowed;
}

async function main() {
  const key = `demo-bucket-${Date.now()}`;

  console.log("--- draining a full bucket (capacity 5) ---");
  for (let i = 1; i <= 5; i++) {
    await fire(key, `burst-${i}`);
  }

  console.log("--- immediately after: bucket should be empty ---");
  await fire(key, "immediate-extra");

  console.log("--- waiting 2.2s for ~1 token to refill (rate: 1 per 2s) ---");
  await sleep(2200);
  await fire(key, "after-refill-1");
  await fire(key, "after-refill-2 (should deny, only ~1 token available)");

  await redis.quit();
}

main();
