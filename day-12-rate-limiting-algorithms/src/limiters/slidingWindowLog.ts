/**
 * Part 2 — sliding window log.
 *
 * WHY a sorted set: each member is one request's own timestamp, scored by
 * that same timestamp. That makes "how many requests happened in the
 * last `windowSeconds`" an exact, queryable fact — `ZREMRANGEBYSCORE` to
 * drop anything older than the window, `ZCARD` to count what's left —
 * instead of the fixed window's calendar-aligned approximation. There is
 * no window boundary for a burst to straddle, because there is no fixed
 * window at all: "the last 10 seconds" is measured from right now, every
 * single time.
 *
 * WHY this is a Lua script and not three separate `ioredis` calls: three
 * round trips (`ZREMRANGEBYSCORE`, then `ZCARD`, then `ZADD`) would have
 * almost the identical race Part 4 is built to demonstrate — two
 * concurrent requests could both read the same `ZCARD` count before
 * either of their `ZADD`s lands, and both pass a check that should only
 * have let one through. Bundling all three into one `EVAL` makes the
 * whole read-check-write sequence atomic, the same fix Part 4 applies to
 * the naive counter, just generalized to three commands instead of one.
 */
import { redis } from "../redis";

const SLIDING_WINDOW_LOG_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - windowMs)
local count = redis.call('ZCARD', key)

if count < limit then
  redis.call('ZADD', key, now, member)
  redis.call('PEXPIRE', key, windowMs)
  return count + 1
else
  return -1
end
`;

export async function checkSlidingWindowLog(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; count: number }> {
  const redisKey = `ratelimit:sliding:${key}`;
  const now = Date.now();
  // Member must be unique even when two requests land in the same
  // millisecond, or ZADD would silently collapse them into one entry.
  const member = `${now}-${Math.random().toString(36).slice(2)}`;

  const result = (await redis.eval(
    SLIDING_WINDOW_LOG_SCRIPT,
    1,
    redisKey,
    now,
    windowSeconds * 1000,
    limit,
    member,
  )) as number;

  return result === -1
    ? { allowed: false, count: limit }
    : { allowed: true, count: result };
}
