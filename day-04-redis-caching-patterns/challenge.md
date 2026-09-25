# Day 4 — Redis Caching Patterns

**Difficulty:** Intermediate
**Tech stack:** Redis, Bun or Node.js
**Estimated time:** 2-3 hours

## Why this matters

Every read in Days 1-3 has been instant, because `todos` has always been a
plain array sitting in memory. That's not what a real backend looks like —
a real "source of truth" is a database over the network, with real
latency, and hitting it on every single read doesn't scale. Redis (or any
cache) sits in front of that slow path and serves repeat reads fast,
*if* it's done correctly. The "if" is the actual subject of today: a
cache that's never invalidated goes stale, and a cache with no TTL can
stay stale forever if you miss an invalidation somewhere.

## Learning objectives

By the end of today you should be able to:

- Connect to Redis from a Bun or Node app and perform basic
  get/set/expire/delete operations
- Implement the cache-aside (lazy-loading) pattern: check the cache first,
  on a miss fall through to the slow path, populate the cache, return
- Set a TTL on a cached entry so staleness has a hard upper bound even if
  an invalidation is ever missed
- Invalidate a cache entry on write, so a create/update doesn't leave a
  stale read behind
- Measure — not assume — the actual latency difference between a cache
  hit and a cache miss

## The challenge

**Part 1 — simulate a real source of truth.** Wrap the in-memory `todos`
array (from Days 1-3) behind a function that awaits an artificial delay
(150-300ms) before returning, standing in for a real database round trip.
Nothing here changes shape — same data, just no longer instant.

**Part 2 — cache-aside in front of the read.** Add Redis in front of the
todo list read (the `todos.list` tRPC query from Day 3, or a fresh
endpoint if you'd rather keep it separate — your choice):

- First request for a given cache key: miss. Falls through to the slow
  path from Part 1, then writes the result into Redis with a TTL before
  returning it.
- Any request within the TTL window: hit. Served straight from Redis,
  without touching the slow path at all.

**Part 3 — invalidate on write.** When `todos.create` runs, invalidate
(or update) the relevant cache key so the *next* read reflects the new
todo instead of serving a stale cached list until the TTL happens to
expire.

Log or return which path was taken (hit or miss) on every read, along
with the actual time it took — the whole point is to end today with real
numbers showing the hit path is meaningfully faster than the miss path,
the same way Day 1 measured cold start instead of assuming Bun was faster.

### Requirements

- Redis is genuinely in the loop — no in-process `Map` standing in for
  "a cache." The point is the real problems caching introduces: a network
  round trip, serialization, and actual expiry semantics, not just a
  local memoization trick
- Every cached entry has a TTL — no cache write without an expiration
- A write invalidates (or correctly updates) the cache — no read should
  ever be able to return data that's known to be stale because of a write
  that already happened
- At least one real, measured hit-vs-miss timing comparison captured in
  `solution.md`

### Constraints

- A local Redis is fine — Docker, Homebrew, or a free-tier hosted instance
  all work equally well for this exercise, no production setup needed
- Either Bun's built-in `Bun.redis` / `RedisClient` or `ioredis` — pick
  one and note briefly why in `solution.md`

## Bonus round (optional)

- Think through (doesn't need a full fix) the cache stampede problem:
  what does your implementation actually do if 50 requests land at the
  exact moment a hot key expires? Note the naive behavior, even if you
  don't solve it
- Try a write-through variant instead of invalidate-on-write — update the
  cache directly with the new state on a write instead of deleting the
  key — and compare the tradeoffs
- Add a second cache key pattern (e.g. caching an individual todo lookup
  alongside the list) and think through what a write now has to
  invalidate

## Resources

- https://bun.com/docs/runtime/redis
- https://redis.io/docs/latest/commands/expire/
- https://redis.io/docs/latest/develop/use/patterns/

---

Once you've built something, write up `solution.md` in this folder using
`../_template/solution.md` as a starting point.
