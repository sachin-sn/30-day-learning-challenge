/**
 * Part 3 — token bucket.
 *
 * WHY this one needs a Lua script more than any other today: the check
 * genuinely has four steps that all depend on each other — read the
 * current token count AND the last-refill time, compute how many tokens
 * should have regenerated since then, cap at capacity, then decide
 * whether to allow and decrement. That's a real read-modify-write chain,
 * not a single counter increment, so doing it as separate `ioredis` calls
 * would be wrong in the same way the naive counter in Part 4 is wrong —
 * just with a wider race window because there's more to read.
 *
 * WHY lazy refill instead of a background job: nothing runs on a timer
 * adding tokens every N milliseconds. Instead, every check computes
 * `elapsed_time * refill_rate` from the last time anyone touched this
 * bucket and adds that many tokens right then, capped at capacity. A
 * bucket nobody has called in an hour still refills correctly the moment
 * it's finally checked again — there's no idle background cost, and nothing
 * to accidentally leave running.
 *
 * WHY this is the one algorithm expected to allow a burst: capacity IS
 * the burst allowance, by design. A client that's been idle long enough
 * to fully refill can legitimately fire `capacity` requests back-to-back
 * — that's not the fixed window's flaw reappearing, it's the deliberate
 * difference between "rate limiting" (token bucket, SNS/SQS-style) and
 * "exact quota enforcement" (sliding window log).
 */
import { redis } from "../redis";

const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillPerSecond = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local bucket = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens = tonumber(bucket[1])
local lastRefill = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  lastRefill = now
end

local elapsedSeconds = math.max(0, now - lastRefill) / 1000
tokens = math.min(capacity, tokens + elapsedSeconds * refillPerSecond)

local allowed = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'lastRefill', now)
redis.call('EXPIRE', key, 3600)

return { allowed, tostring(tokens) }
`;

export async function checkTokenBucket(
  key: string,
  capacity: number,
  refillPerSecond: number,
): Promise<{ allowed: boolean; tokensRemaining: number }> {
  const redisKey = `ratelimit:bucket:${key}`;
  const now = Date.now();

  const [allowed, tokensRemaining] = (await redis.eval(
    TOKEN_BUCKET_SCRIPT,
    1,
    redisKey,
    capacity,
    refillPerSecond,
    now,
  )) as [number, string];

  return { allowed: allowed === 1, tokensRemaining: parseFloat(tokensRemaining) };
}
