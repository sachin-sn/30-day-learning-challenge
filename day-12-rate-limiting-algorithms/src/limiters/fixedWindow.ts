/**
 * Part 1 — fixed window counter.
 *
 * WHY `INCR` alone is enough here, with no Lua script: `INCR` is already
 * atomic in Redis — a single command, no read-modify-write gap for two
 * concurrent callers to race inside. The only two-step part is "set an
 * expiry only on the very first increment of a window," and even that
 * race is harmless: worst case, two concurrent *first* requests both set
 * the same `EXPIRE` to the same value, which is a no-op duplicate, not a
 * correctness bug.
 *
 * WHY this algorithm still has a real flaw despite being internally race
 * -free: the window is a fixed, calendar-aligned bucket
 * (`floor(now / windowSeconds) * windowSeconds`), not a rolling window
 * measured from each request. Five requests at 0:09 and five more at
 * 0:11 land in two DIFFERENT fixed windows (0:00-0:10 and 0:10-0:20) and
 * are each independently under the limit of 5 — even though only 2
 * seconds separated all ten requests. See demo-fixed-window-burst.ts.
 */
import { redis } from "../redis";

export async function checkFixedWindow(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; count: number; windowStart: number }> {
  const windowStart =
    Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
  const redisKey = `ratelimit:fixed:${key}:${windowStart}`;

  const count = await redis.incr(redisKey);
  if (count === 1) {
    // Only the request that just created this window's counter needs to
    // set its lifetime — every later call in the same window is
    // incrementing a key that's already going to expire on schedule.
    await redis.expire(redisKey, windowSeconds);
  }

  return { allowed: count <= limit, count, windowStart };
}
