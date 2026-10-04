/**
 * Reusable single-instance Redis lock — the base for Day 13's Parts 1-4.
 *
 * Built from the working pieces of the original lock.ts:
 *   - acquire: SET key token NX PX ttl   (atomic "create only if absent, with expiry")
 *   - release: Lua compare-and-delete    (only delete if the key still holds MY token)
 *
 * Changes from lock.ts and why:
 *   - Token is a UUID. `token_${name}_${Date.now()}` can collide when the same
 *     worker name builds two tokens in the same millisecond, and release safety
 *     depends entirely on tokens being unique.
 *   - Resource name and TTL are parameters, not constants, so many workers (and
 *     later Part 2's short TTL) can reuse one implementation.
 *   - `acquire` waits (retry + jitter) up to maxWaitMs; `tryAcquire` is the
 *     single non-blocking attempt that lock.ts's worker() effectively did.
 *   - A Lock object carries its own token, so `release(lock)` can't be called
 *     with someone else's token by accident.
 */
import { randomUUID } from "node:crypto";
import { redis } from "./redis";

export interface Lock {
  resource: string;
  key: string;
  token: string;
  ttlMs: number;
  acquiredAt: number; // Date.now() when SET succeeded (useful for Part 2 logs)
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Same script as lock.ts: delete only if the stored value is still my token.
// Must be one Lua script (not GET then DEL) or the gap between the two calls
// is exactly the Day 12 race, just on a lock instead of a counter.
const RELEASE_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

/** One non-blocking attempt. Returns the Lock, or null if someone else holds it. */
export async function tryAcquire(resource: string, ttlMs: number): Promise<Lock | null> {
  const key = `lock:${resource}`;
  const token = randomUUID();
  const result = await redis.set(key, token, "PX", ttlMs, "NX");
  return result === "OK"
    ? { resource, key, token, ttlMs, acquiredAt: Date.now() }
    : null;
}

/**
 * Wait for the lock: retry with jitter until acquired or maxWaitMs elapses.
 * Returns null on timeout (callers decide what that means).
 */
export async function acquire(
  resource: string,
  ttlMs: number,
  opts: { retryDelayMs?: number; maxWaitMs?: number } = {},
): Promise<Lock | null> {
  const { retryDelayMs = 20, maxWaitMs = 10_000 } = opts;
  const deadline = Date.now() + maxWaitMs;

  while (true) {
    const lock = await tryAcquire(resource, ttlMs);
    if (lock) return lock;
    if (Date.now() >= deadline) return null;
    // Jitter so N waiting workers don't all retry in the same tick.
    await sleep(retryDelayMs + Math.random() * retryDelayMs);
  }
}

/**
 * Release only if the lock is still mine. Returns false when the key is gone
 * or now holds another worker's token — i.e. the TTL expired under me (Part 2).
 */
export async function release(lock: Lock): Promise<boolean> {
  const result = await redis.eval(RELEASE_SCRIPT, 1, lock.key, lock.token);
  return result === 1;
}
