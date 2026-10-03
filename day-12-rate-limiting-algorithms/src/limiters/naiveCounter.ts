/**
 * Part 4 — the deliberately broken version, built first on purpose.
 *
 * WHY this looks completely reasonable if you haven't been burned by it
 * before: read the count, compare it to the limit in plain application
 * code, and only increment if you're still under it. That's exactly how
 * you'd check a limit against an in-memory variable, and it's correct if
 * there's only ever one caller at a time.
 *
 * WHY it's actually broken: `GET` and `INCR` are each individually atomic,
 * but the gap BETWEEN them is not. Fire enough concurrent calls and
 * several of them can all `GET` the same pre-increment value before any
 * of them has run its own `INCR` yet — every one of those calls sees
 * itself as "the Nth request," passes the check, and increments. The
 * limit was never actually enforced against the real, current count; it
 * was enforced against a snapshot that was already stale by the time the
 * decision got made. See demo-race-condition.ts for the real numbers.
 */
import { redis } from "../redis";

export async function checkNaiveCounter(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; countAtCheckTime: number }> {
  const redisKey = `ratelimit:naive:${key}`;

  // Step 1: read the current count. Any number of other concurrent calls
  // can run this exact same read before step 3 of ANY of them completes.
  const current = await redis.get(redisKey);
  const countAtCheckTime = current ? parseInt(current, 10) : 0;

  // Step 2: decide, in plain JS, based on a value that may already be
  // stale by the time this line runs.
  if (countAtCheckTime >= limit) {
    return { allowed: false, countAtCheckTime };
  }

  // Step 3: only now do we actually record this request — too late to
  // undo the decision already made in step 2 against stale data.
  const newCount = await redis.incr(redisKey);
  if (newCount === 1) {
    await redis.expire(redisKey, windowSeconds);
  }

  return { allowed: true, countAtCheckTime };
}

/**
 * The fix: collapse the whole "read, decide, write" sequence into the
 * one Redis command that was already atomic the entire time. There's
 * no window left for a second caller to read a stale value, because
 * there's no separate read at all — `INCR` returns the already-updated,
 * guaranteed-correct count directly, and the decision is made from that
 * return value instead of from a value fetched a moment earlier.
 */
export async function checkAtomicCounter(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; count: number }> {
  const redisKey = `ratelimit:atomic:${key}`;

  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.expire(redisKey, windowSeconds);
  }

  return { allowed: count <= limit, count };
}
