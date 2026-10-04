/**
 * Part 1 — the happy path.
 *
 *   npm run part1            5 workers x 20 increments INSIDE the lock  -> expect exactly 100
 *   npm run part1:nolock     same work with NO lock                      -> count the lost updates
 *
 * Prediction to write down before running the no-lock version: with 5 workers
 * each doing read -> pause -> write, most increments overwrite each other.
 * (Fill in your guess here: ______ lost out of 100.)
 *
 * The critical section is deliberately a read-modify-write with a small pause
 * between the read and the write. That pause is the "lost-update machine": any
 * two workers inside it at once will both write read+1 and one increment vanishes.
 */
import { acquire, release } from "./redisLock";
import { redis } from "./redis";

const WORKERS = 5;
const INCREMENTS = 20;
const LOCK_TTL_MS = 5_000; // far longer than the ~5ms critical section: Part 1 must not hit expiry
const COUNTER_KEY = "demo:counter";
const useLock = !process.argv.includes("--no-lock");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function criticalSection() {
  const current = parseInt((await redis.get(COUNTER_KEY)) ?? "0", 10);
  await sleep(Math.random() * 10); // simulated work between read and write
  await redis.set(COUNTER_KEY, String(current + 1));
}

async function worker(id: number) {
  let lostLocks = 0;
  for (let i = 0; i < INCREMENTS; i++) {
    if (!useLock) {
      await criticalSection();
      continue;
    }
    const lock = await acquire("counter", LOCK_TTL_MS);
    if (!lock) throw new Error(`worker ${id} could not acquire the lock in time`);
    try {
      await criticalSection();
    } finally {
      // false here would mean the TTL expired under us — not expected in Part 1.
      if (!(await release(lock))) lostLocks++;
    }
  }
  return lostLocks;
}

async function main() {
  await redis.set(COUNTER_KEY, "0");
  const started = Date.now();

  const lostLocks = await Promise.all(
    Array.from({ length: WORKERS }, (_, i) => worker(i + 1)),
  );

  const expected = WORKERS * INCREMENTS;
  const finalValue = parseInt((await redis.get(COUNTER_KEY)) ?? "0", 10);
  console.log(`mode:        ${useLock ? "WITH lock" : "NO lock"}`);
  console.log(`expected:    ${expected}`);
  console.log(`final value: ${finalValue}`);
  console.log(`lost updates: ${expected - finalValue}`);
  if (useLock) {
    console.log(`locks that expired before release: ${lostLocks.reduce((a, b) => a + b, 0)}`);
  }
  console.log(`elapsed:     ${Date.now() - started}ms`);

  await redis.quit();
}

main();
