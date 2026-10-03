# Day 12 — Solution: Rate Limiting Algorithms from Scratch

**Blog post:** <link, once published>
**LinkedIn post:** <link, once shared>

## Setup

```
npm install
redis-server --daemonize yes          # or reuse Day 4's Docker Redis
npm run demo:race             # Part 4 — the race condition, fast (~instant)
npm run demo:token-bucket     # Part 3 — burst then throttle, ~2.5s
npm run demo:fixed-window     # Part 1 — boundary burst, up to ~10s (waits for a window edge)
npm run demo:sliding-window   # Part 2 — identical burst, up to ~10s
```

## Approach

Four limiters, one shared `redis.ts` connection, each exposing its own
`checkX(key, ...)` async function rather than forcing a single interface
on algorithms that genuinely need different parameters (a window has a
duration; a bucket has a capacity and a refill rate). Built Part 4's
naive-then-fixed pair first, conceptually, even though it's listed last —
the race condition it demonstrates is *why* the sliding window log and
token bucket are implemented as single Lua scripts instead of multiple
Redis calls, so understanding the break came before writing the "correct"
versions.

## Key concepts learned

- **A fixed window's flaw isn't a bug — it's just what "fixed window"
  means, and it's trivial to trigger on purpose.** Five requests fired
  right before a 10-second window boundary, five more right after:

  ```
  [fixed-window] 17:02:49.703 request A1 -> ALLOWED
  [fixed-window] 17:02:49.704 request A2 -> ALLOWED
  [fixed-window] 17:02:49.704 request A3 -> ALLOWED
  [fixed-window] 17:02:49.704 request A4 -> ALLOWED
  [fixed-window] 17:02:49.705 request A5 -> ALLOWED
  [fixed-window] 17:02:50.306 request B1 -> ALLOWED
  [fixed-window] 17:02:50.306 request B2 -> ALLOWED
  [fixed-window] 17:02:50.306 request B3 -> ALLOWED
  [fixed-window] 17:02:50.307 request B4 -> ALLOWED
  [fixed-window] 17:02:50.307 request B5 -> ALLOWED
  RESULT: 10/10 requests allowed within ~1.2s, against a configured limit of 5 per 10s
  ```

  All 10 allowed in roughly 600 milliseconds, against "5 per 10 seconds."
  Each `INCR` is individually atomic and correct — the flaw isn't a race,
  it's that `floor(now / 10) * 10` puts the two batches in two different,
  independent counters.
- **The exact same burst, same millisecond-level timing, against a
  sliding window log — and the result flips.**

  ```
  [sliding-window] 17:02:59.705 request A1 -> ALLOWED
  [sliding-window] 17:02:59.706 request A2 -> ALLOWED
  [sliding-window] 17:02:59.706 request A3 -> ALLOWED
  [sliding-window] 17:02:59.706 request A4 -> ALLOWED
  [sliding-window] 17:02:59.707 request A5 -> ALLOWED
  [sliding-window] 17:03:00.308 request B1 -> DENIED
  [sliding-window] 17:03:00.309 request B2 -> DENIED
  [sliding-window] 17:03:00.309 request B3 -> DENIED
  [sliding-window] 17:03:00.309 request B4 -> DENIED
  [sliding-window] 17:03:00.310 request B5 -> DENIED
  RESULT: 5/10 requests allowed within ~1.2s, against a configured limit of 5 per 10s
  ```

  Exactly 5 of 10, regardless of which side of the clock-aligned boundary
  each request fell on — because there IS no clock-aligned boundary here,
  only "how many timestamps are in the sorted set from `now - 10s` to
  `now`." Same limit, same burst, opposite outcome, side by side.
- **The token bucket is the one algorithm that's SUPPOSED to allow a
  burst — and it does, then throttles exactly on schedule.** Capacity 5,
  refill 1 token/2s:

  ```
  17:02:32.672 burst-1 -> ALLOWED (tokens remaining: 4.00)
  17:02:32.673 burst-2 -> ALLOWED (tokens remaining: 3.01)
  17:02:32.674 burst-3 -> ALLOWED (tokens remaining: 2.01)
  17:02:32.674 burst-4 -> ALLOWED (tokens remaining: 1.01)
  17:02:32.674 burst-5 -> ALLOWED (tokens remaining: 0.01)
  17:02:32.675 immediate-extra -> DENIED  (tokens remaining: 0.01)
  17:02:34.878 after-refill-1 -> ALLOWED (tokens remaining: 0.11)
  17:02:34.879 after-refill-2 ... -> DENIED  (tokens remaining: 0.11)
  ```

  Five immediate requests drained the bucket in under a millisecond, the
  6th was denied with ~0 tokens left, and after waiting 2.2 seconds
  (≈1.1 tokens at the configured rate) exactly one more request got
  through before the next was denied again. This isn't the fixed
  window's flaw resurfacing — a real client that's been idle long enough
  to refill legitimately gets to burst up to capacity. That's the
  design, not an accident.
- **The race condition this whole day is built around turned out to be
  more dramatic than "slightly over the limit" — the naive version let
  through every single request.**

  ```
  --- naive counter: 20 concurrent requests, limit 5 ---
  naive counter allowed 20/20 requests (configured limit: 5) — RACE CONDITION CONFIRMED

  --- atomic counter: 20 concurrent requests, limit 5 ---
  atomic counter allowed 5/20 requests (configured limit: 5) — CORRECT
  ```

  All 20 concurrent calls, not just a handful, got through the naive
  `GET`-then-check-then-`INCR` version — because `Promise.all` fires all
  20 `GET`s in the same tick, and Redis/Node's event loop answers all of
  them before any of the 20 callers gets around to its own `INCR`. Every
  single one reads the same pre-increment count, every single one thinks
  it's "under the limit." The one-line fix — replace the `GET` + app-code
  check with a single `INCR`, then check the number it returns — produced
  exactly 5 allowed, every time this was re-run. No partial improvement,
  no "mostly correct now": atomic either fully closes the gap or it
  doesn't, and here it did.

### Which algorithm for which job

| Use case | Pick | Why |
| --- | --- | --- |
| Login-attempt limiter | Sliding window log (or fixed window, if approximate is fine) | You want an exact, hard cap — "5 attempts in any 10-minute span," no boundary trick that effectively doubles it |
| Public API per-client quota | Token bucket | Legitimate clients burst sometimes (a dashboard loading 10 widgets at once); a hard sliding-window cap penalizes normal usage patterns that fixed/sliding windows would flag as abuse |
| High-traffic endpoint, approximate limit acceptable | Fixed window counter | Cheapest to implement and store (one integer, not a growing sorted set); the boundary-doubling flaw matters far less when the limit is "10,000 req/min" than when it's "5 login attempts" |

## Code walkthrough

- `src/redis.ts` — one shared `ioredis` connection for every limiter.
- `src/limiters/fixedWindow.ts` — Part 1. A single `INCR` + conditional
  `EXPIRE`; the flaw is structural (calendar-aligned windows), not a race.
- `src/limiters/slidingWindowLog.ts` — Part 2. A Lua script (`ZREMRANGEBYSCORE`
  + `ZCARD` + `ZADD` in one atomic `EVAL`) instead of three separate
  commands, for the same reason Part 4 exists.
- `src/limiters/tokenBucket.ts` — Part 3. Lazy refill computed from
  elapsed time since the bucket's own last-touched timestamp, stored in a
  Redis hash, all inside one Lua script.
- `src/limiters/naiveCounter.ts` — Part 4. Both `checkNaiveCounter`
  (broken: `GET` → app-code check → `INCR`) and `checkAtomicCounter`
  (fixed: a single `INCR`, decide from its return value) live here
  side by side, same file, for direct comparison.
- `src/boundaryBurstHarness.ts` — the literal same burst-timing logic
  shared by the Part 1 and Part 2 demos, so the comparison between fixed
  and sliding window isn't two independently-built tests that merely
  look similar.
- `src/demo-*.ts` — one runnable script per part; each prints its
  prediction in a comment before running.

## Gotchas / things that tripped me up

- The sliding window log's three "obvious" commands
  (`ZREMRANGEBYSCORE`/`ZCARD`/`ZADD`) have exactly the same race shape as
  the naive counter if you don't bundle them into one Lua script —
  realized this while writing Part 2, before even getting to Part 4,
  which is why both ended up solved the same way.
- `ZADD` needs a unique *member*, not just a score — using the timestamp
  alone as both score and member would silently collapse two requests
  landing in the same millisecond into one entry in the sorted set,
  quietly under-counting real traffic. Appending a random suffix to the
  member fixes it without affecting the score-based window math at all.
- Timing the boundary-burst demos against a real wall clock means the
  wait before the first batch varies every run (anywhere from a few
  hundred milliseconds to nearly 10 seconds, depending on when in the
  current window the script happens to start) — not a bug, just means
  the "waiting Nms" log line is never the same number twice.

## What I'd do differently

<TODO: your own words — e.g. add the bonus sliding-window *counter*
(current + previous window blended) and measure how close its
approximation gets to the sliding log's exact count under the same
burst; key everything per simulated user id and prove isolation between
keys; wire a real `429` + `Retry-After` response and a tiny backoff
client around whichever limiter ends up in front of the actual todo API.>

## Further reading

- https://redis.io/glossary/rate-limiting/
- https://stripe.com/blog/rate-limiters
- https://en.wikipedia.org/wiki/Token_bucket
- https://redis.io/docs/latest/develop/interact/programmability/eval-intro/
