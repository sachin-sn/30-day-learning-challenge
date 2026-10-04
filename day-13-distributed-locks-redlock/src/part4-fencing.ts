/**
 * Part 4 — fencing tokens: make the RESOURCE refuse stale writers.
 *
 * Parts 2-3 showed a TTL can't stop a stalled worker from waking up and acting
 * as if it still holds the lock. The lock service can't fix that (it has no
 * way to interrupt A), so the fix moves to the thing being protected:
 *
 *   1. Every successful acquire also returns a fencing token — a number that
 *      only ever goes up (Redis INCR).
 *   2. Every write to the resource carries that token.
 *   3. The resource remembers the highest token it has seen and rejects any
 *      write with a lower one.
 *
 * Same timeline as Part 2, run twice — once with a resource that ignores the
 * token, once with a resource that checks it:
 *   t=0     A acquires (token 1, ttl 1s), then stalls 2s
 *   t=~1s   A's lock expires; B acquires (token 2), writes "B" at ~1.2s
 *   t=2s    A wakes up and writes "A" with its stale token 1
 *
 * Prediction (fill in before running):
 *   Without fencing, what is the final value?   ______
 *   With fencing, what is the final value?      ______
 *   With fencing, what happens to A's write?    ______
 */
import { randomUUID } from "node:crypto";
import { acquire, release, type Lock } from "./redisLock";
import { redis } from "./redis";

const TTL_MS = 1000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Acquire + fencing token, in ONE Lua script.
// Doing SET then INCR as two calls would be a bug: if A stalled between them
// past the TTL, B could acquire and INCR first and get the LOWER token.
// ---------------------------------------------------------------------------
const ACQUIRE_FENCED_SCRIPT = `
  if redis.call("set", KEYS[1], ARGV[1], "NX", "PX", ARGV[2]) then
    return redis.call("incr", KEYS[2])
  else
    return false
  end
`;

interface FencedLock extends Lock {
  fence: number;
}

async function tryAcquireFenced(
  resource: string,
  ttlMs: number,
): Promise<FencedLock | null> {
  const key = `lock:${resource}`;
  const token = randomUUID();
  const fence = await redis.eval(
    ACQUIRE_FENCED_SCRIPT,
    2,
    key,
    `fence:${resource}`,
    token,
    ttlMs,
  );
  return fence === null || fence === false
    ? null
    : {
        resource,
        key,
        token,
        ttlMs,
        acquiredAt: Date.now(),
        fence: Number(fence),
      };
}

async function acquireFenced(
  resource: string,
  ttlMs: number,
  maxWaitMs = 5000,
) {
  const deadline = Date.now() + maxWaitMs;
  while (true) {
    const lock = await tryAcquireFenced(resource, ttlMs);
    if (lock) return lock;
    if (Date.now() >= deadline) return null;
    await sleep(20 + Math.random() * 20);
  }
}

// ---------------------------------------------------------------------------
// The protected resource — stands in for a database / file / storage service.
// The check-and-write is synchronous here, so it is atomic in one Node process.
// A real resource must do the same check atomically (e.g. a conditional write
// or a Lua script / transaction).
// ---------------------------------------------------------------------------
class Resource {
  value = "(empty)";
  private highestFence = 0;
  constructor(
    private enforceFencing: boolean,
    private log: (m: string) => void,
  ) {}

  write(who: string, fence: number, value: string): boolean {
    if (this.enforceFencing && fence < this.highestFence) {
      this.log(
        `[store] REJECTED write from ${who} (fence ${fence} < highest seen ${this.highestFence})`,
      );
      return false;
    }
    this.highestFence = Math.max(this.highestFence, fence);
    this.value = value;
    this.log(
      `[store] accepted write from ${who} (fence ${fence}) -> value = "${value}"`,
    );
    return true;
  }
}

async function runScenario(enforceFencing: boolean) {
  const label = enforceFencing ? "WITH fencing" : "WITHOUT fencing";
  const resource = `part4-${enforceFencing ? "on" : "off"}-${Date.now()}`;
  const t0 = Date.now();
  const log = (msg: string) =>
    console.log(`+${String(Date.now() - t0).padStart(5)}ms  ${msg}`);
  const store = new Resource(enforceFencing, log);

  console.log(`\n=== ${label} ===`);

  async function workerA() {
    const lock = await acquireFenced(resource, TTL_MS);
    if (!lock) return;
    log(
      `[A] acquired lock, fence token ${lock.fence}; stalling 2s (ttl is 1s)`,
    );
    await sleep(2000);
    log(`[A] woke up, still believes it holds the lock — writing`);
    store.write("A", lock.fence, "written by A");
    const ok = await release(lock);
    log(`[A] release -> ${ok}`);
  }

  async function workerB() {
    await sleep(100);
    const lock = await acquireFenced(resource, 5000);
    if (!lock) return;
    log(`[B] acquired lock, fence token ${lock.fence}`);
    await sleep(200);
    store.write("B", lock.fence, "written by B");
    const ok = await release(lock);
    log(`[B] release -> ${ok}`);
  }

  await Promise.all([workerA(), workerB()]);
  await redis.del(`lock:${resource}`, `fence:${resource}`);
  log(`FINAL VALUE: "${store.value}"`);
  return store.value;
}

async function main() {
  const without = await runScenario(false);
  const withFence = await runScenario(true);

  console.log("\n--- summary ---");
  console.log(
    `without fencing: "${without}"  ${without === "written by A" ? "(stale writer A overwrote newer data from B — BROKEN)" : ""}`,
  );
  console.log(
    `with fencing   : "${withFence}"  ${withFence === "written by B" ? "(A's stale write was rejected — CORRECT)" : "(unexpected)"}`,
  );
  await redis.quit();
}

main();
