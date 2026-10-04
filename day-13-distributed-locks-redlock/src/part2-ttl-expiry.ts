/**
 * Part 2 — the lock expires while its owner is still working.
 *
 * Scenario: A takes a 1s lock, then stalls for 2s inside the critical section
 * (a GC pause, a slow downstream call, a laptop lid closing — anything that
 * outlasts the TTL). Redis has no idea A is still working; at t=1s it just
 * deletes the key. B, waiting in acquire(), gets the lock and enters too.
 *
 * Prediction (fill in before running):
 *   Will A and B be inside the critical section at the same time?  ______
 *   For roughly how long?                                           ______
 *   What will A's release() return when it finally finishes?        ______
 *   Will B's lock still be there after A's release attempt?         ______
 */
import { acquire, release } from "./redisLock";
import { redis } from "./redis";

const RESOURCE = `part2-${Date.now()}`;
const TTL_MS = 1000;
const A_WORK_MS = 2000;
const B_WORK_MS = 1500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const t0 = Date.now();
const at = () => `+${String(Date.now() - t0).padStart(5)}ms`;
const log = (who: string, msg: string) => console.log(`${at()}  [${who}] ${msg}`);

// Overlap detector: how many workers are inside the critical section right now.
let inside = 0;
let overlapStart: number | null = null;
let overlapTotalMs = 0;

function enter(who: string) {
  inside++;
  log(who, `ENTER critical section (inside = ${inside})`);
  if (inside === 2) {
    overlapStart = Date.now();
    log("!!!", "two workers are inside the critical section at once");
  }
}
function leave(who: string) {
  if (inside === 2 && overlapStart !== null) {
    overlapTotalMs += Date.now() - overlapStart;
    overlapStart = null;
  }
  inside--;
  log(who, `LEAVE critical section (inside = ${inside})`);
}

async function workerA() {
  const lock = await acquire(RESOURCE, TTL_MS);
  if (!lock) return log("A", "could not acquire");
  log("A", `acquired lock (ttl ${TTL_MS}ms)`);
  enter("A");
  await sleep(A_WORK_MS); // outlasts the TTL
  leave("A");
  const ok = await release(lock);
  log("A", `release() -> ${ok}  ${ok ? "" : "(lock was no longer mine — TTL had expired)"}`);
}

async function workerB() {
  await sleep(100); // let A win the first acquire
  log("B", "waiting for lock...");
  const lock = await acquire(RESOURCE, 5000, { maxWaitMs: 5000 });
  if (!lock) return log("B", "could not acquire");
  log("B", "acquired lock");
  enter("B");
  await sleep(B_WORK_MS);
  leave("B");
  const ok = await release(lock);
  log("B", `release() -> ${ok}`);
}

// Watches who owns the key after A's late release, to show B's lock survived.
async function observer() {
  await sleep(A_WORK_MS + 50);
  const holder = await redis.get(`lock:${RESOURCE}`);
  log("obs", `after A's release attempt, lock key is ${holder ? "STILL HELD (by B)" : "gone"}`);
}

async function main() {
  console.log(`TTL ${TTL_MS}ms, A works ${A_WORK_MS}ms, B works ${B_WORK_MS}ms\n`);
  await Promise.all([workerA(), workerB(), observer()]);
  console.log(`\nTotal time with 2 workers inside the critical section: ~${overlapTotalMs}ms`);
  console.log(
    overlapTotalMs > 0
      ? "RESULT: mutual exclusion BROKEN by TTL expiry — no lock error was ever raised."
      : "RESULT: no overlap this run.",
  );
  await redis.quit();
}

main();
