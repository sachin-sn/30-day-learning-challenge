/**
 * Part 4 — break it, then fix it.
 *
 * Prediction before running: firing 20 concurrent requests at the naive
 * GET-then-check-then-INCR limiter, against a limit of 5, should allow
 * MORE than 5 — because enough of those 20 calls will read the same
 * pre-increment count before any of their own INCRs land. Firing the
 * same 20 concurrent requests at the atomic INCR-based limiter should
 * allow EXACTLY 5, every time.
 */
import { checkNaiveCounter, checkAtomicCounter } from "./limiters/naiveCounter";
import { redis } from "./redis";

const CONCURRENT_REQUESTS = 20;
const LIMIT = 5;

async function runNaiveTest() {
  const key = `demo-naive-${Date.now()}`;
  console.log(`--- naive counter: ${CONCURRENT_REQUESTS} concurrent requests, limit ${LIMIT} ---`);

  const results = await Promise.all(
    Array.from({ length: CONCURRENT_REQUESTS }, () => checkNaiveCounter(key, LIMIT, 10)),
  );

  const allowed = results.filter((r) => r.allowed).length;
  console.log(
    `naive counter allowed ${allowed}/${CONCURRENT_REQUESTS} requests ` +
      `(configured limit: ${LIMIT}) — ${allowed > LIMIT ? "RACE CONDITION CONFIRMED" : "no race this run"}`,
  );
  return allowed;
}

async function runAtomicTest() {
  const key = `demo-atomic-${Date.now()}`;
  console.log(`--- atomic counter: ${CONCURRENT_REQUESTS} concurrent requests, limit ${LIMIT} ---`);

  const results = await Promise.all(
    Array.from({ length: CONCURRENT_REQUESTS }, () => checkAtomicCounter(key, LIMIT, 10)),
  );

  const allowed = results.filter((r) => r.allowed).length;
  console.log(
    `atomic counter allowed ${allowed}/${CONCURRENT_REQUESTS} requests ` +
      `(configured limit: ${LIMIT}) — ${allowed === LIMIT ? "CORRECT" : "UNEXPECTED"}`,
  );
  return allowed;
}

async function main() {
  await runNaiveTest();
  console.log();
  await runAtomicTest();
  await redis.quit();
}

main();
