/**
 * Part 3 — releasing a lock you no longer own.
 *
 * Same stall as Part 2 (A holds a 1s lock but works for 2s; B takes over at
 * ~1s), but now A's release is the one that matters. Two release strategies,
 * run through the identical timeline:
 *
 *   naive: plain DEL key            — deletes whatever is there, owner or not
 *   safe : Lua compare-and-delete   — deletes only if the value is MY token
 *
 * Timeline (both runs):
 *   t=0     A acquires (ttl 1s), starts 2s of work
 *   t=~1s   A's key expires; B acquires, starts 2s of work
 *   t=2s    A finishes, releases            <- the interesting moment
 *   t=2.3s  C tries to acquire (single try) <- is B still protected?
 *
 * Prediction (fill in before running):
 *   Naive: does C get in while B is still working?      ______
 *   Safe : does C get in?                               ______
 *   Naive: what does A's DEL return?                    ______
 */
import { acquire, tryAcquire, release, type Lock } from "./redisLock";
import { redis } from "./redis";

const TTL_MS = 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The broken release: no ownership check at all.
async function naiveRelease(lock: Lock): Promise<boolean> {
  const deleted = await redis.del(lock.key);
  return deleted === 1;
}

async function runScenario(label: string, releaseFn: (l: Lock) => Promise<boolean>) {
  const resource = `part3-${label}-${Date.now()}`;
  const t0 = Date.now();
  const log = (who: string, msg: string) =>
    console.log(`+${String(Date.now() - t0).padStart(5)}ms  [${who}] ${msg}`);

  console.log(`\n=== ${label.toUpperCase()} release ===`);

  let bHolding = false;
  let cEnteredWhileBHolding = false;

  async function workerA() {
    const lock = await acquire(resource, TTL_MS);
    if (!lock) return;
    log("A", "acquired (ttl 1s), working 2s");
    await sleep(2000);
    const ok = await releaseFn(lock);
    log("A", `release -> ${ok}${ok ? "   <-- A deleted a lock it did NOT own" : ""}`);
  }

  async function workerB() {
    await sleep(100);
    const lock = await acquire(resource, 5000, { maxWaitMs: 5000 });
    if (!lock) return;
    bHolding = true;
    log("B", "acquired (took over after A's TTL expired), working 2s");
    await sleep(2000);
    bHolding = false;
    const ok = await releaseFn(lock);
    log("B", `release -> ${ok}`);
  }

  async function workerC() {
    await sleep(2300);
    const lock = await tryAcquire(resource, 5000);
    if (lock) {
      cEnteredWhileBHolding = bHolding;
      log("C", `acquired${bHolding ? "  <-- while B is STILL working" : ""}`);
      await sleep(500);
      await releaseFn(lock);
    } else {
      log("C", "denied (B's lock is intact)");
    }
  }

  await Promise.all([workerA(), workerB(), workerC()]);
  await redis.del(`lock:${resource}`);
  return cEnteredWhileBHolding;
}

async function main() {
  const naive = await runScenario("naive", naiveRelease);
  const safe = await runScenario("safe", release);

  console.log("\n--- summary ---");
  console.log(`naive DEL : C entered while B held the lock? ${naive ? "YES (broken)" : "no"}`);
  console.log(`Lua check : C entered while B held the lock? ${safe ? "YES (broken)" : "no (correct)"}`);
  await redis.quit();
}

main();
