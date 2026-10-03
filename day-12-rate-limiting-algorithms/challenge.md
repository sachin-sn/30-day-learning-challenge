# Day 12 — Rate Limiting Algorithms from Scratch

**Difficulty:** Intermediate
**Tech stack:** Node.js, TypeScript, Redis (reusing Day 4's setup)
**Estimated time:** 2-3 hours

## Why this matters

Every API that survives contact with the real world eventually returns a
`429`. Reaching for a rate-limiting middleware package hides exactly the
part worth understanding: there are a handful of genuinely different
algorithms for "too many requests," they fail in different, specific
ways, and picking one is a real design decision, not a configuration
toggle. This is also a long-standing interview staple for almost the same
reason Day 5's single-table design was — it's one of the few topics where
"describe the tradeoff between two approaches" has a concrete, correct
answer if you've actually built both and watched them behave differently
under the same traffic.

## Learning objectives

By the end of today you should be able to:

- Implement a fixed-window counter using Redis `INCR`/`EXPIRE` and
  demonstrate its classic weakness directly: a burst clustered around a
  window boundary gets through at roughly double the configured rate,
  not because of a bug, but because of how the algorithm is defined
- Implement a sliding-window log using a Redis sorted set and confirm it
  rejects the exact same boundary-straddling burst that the fixed window
  let through
- Implement a token bucket and show it does something neither of the
  above do on purpose: absorb a legitimate burst up to the bucket's
  capacity, then throttle to the steady refill rate — a feature, not a
  compromise
- Break a rate limiter with a real race condition before fixing it —
  implement the "obvious" non-atomic check-then-increment version first,
  prove with concurrent requests that it lets more through than the
  configured limit, then fix it with a single atomic Redis operation (or
  a Lua script) and prove the fix with the same concurrent test
- Explain why rate-limit state has to live somewhere shared (Redis, same
  as Day 4) the moment there's more than one server process, rather than
  a counter living in each process's own memory

## The challenge

Build a `checkLimit(key)` function with three interchangeable
implementations, all backed by the same Redis instance from Day 4, all
limiting the same thing: calls to a todo-creation endpoint, same domain
as every prior day.

**Part 1 — fixed window counter.** Implement a limiter allowing 5
requests per 10-second window using `INCR` on a key like
`ratelimit:fixed:<window-start>` with `EXPIRE` set on first increment.
Then deliberately construct the failure case: send 5 requests in the
final second of one window, then 5 more in the first second of the next
window. Confirm — by actually running it and logging real timestamps —
that all 10 got allowed within about a 2-second span, against a limit
that's supposed to mean "5 per 10 seconds." Write down why this happens
*before* you run it: it's not a bug, it's what "fixed window" means.

**Part 2 — sliding window log.** Implement the same 5-per-10-seconds
limit using a Redis sorted set per key: `ZADD` the current timestamp on
each request, `ZREMRANGEBYSCORE` to drop anything older than the window,
then `ZCARD` to count what's left and compare to the limit. Run the
*exact same* boundary-straddling burst from Part 1 against this
implementation and confirm it correctly allows only 5 of the 10 — direct,
side-by-side proof of the difference, not an assertion about it.

**Part 3 — token bucket.** Implement a bucket with capacity 5 and a
refill rate of 1 token every 2 seconds, using a Lua script (via
`EVAL`) so the read-check-refill-decrement sequence is atomic — this one
can't be done safely with a single Redis command the way Part 1 could.
Send a burst of 5 requests immediately (all should succeed, draining the
bucket), then confirm requests sent faster than the refill rate get
rejected until enough time has passed for tokens to regenerate. This is
the one algorithm today that's *supposed* to allow an initial burst —
confirm that's actually what happens, with real timestamps showing the
throttle-to-refill-rate behavior once the initial burst is spent.

**Part 4 — break it, then fix it.** Before touching any of the three
implementations above, build a fourth, deliberately naive limiter: `GET`
the current count, check it against the limit in your application code,
and only then `INCR` if it's under — three separate round trips, nothing
atomic. Fire 20 concurrent requests at it with `Promise.all` against a
limit of 5, and count how many actually got allowed. Predict the number
first, then run it. Then make the one-line fix (replace the
GET-then-check-then-INCR with a single atomic `INCR`, check the
*returned* value) and re-run the identical concurrent test to confirm
it now admits exactly 5, every time you run it.

### Requirements

- Four working limiter implementations (fixed window, sliding window
  log, token bucket, and the broken-then-fixed naive counter), all
  sharing one Redis instance, all gated behind the same `checkLimit(key):
  Promise<boolean>` shape
- The boundary-burst test actually run against both the fixed window and
  the sliding window log, with real logged timestamps showing the
  difference, not just described
- The token bucket's burst-then-throttle behavior actually observed with
  real timestamps
- The race condition in the naive counter actually triggered and counted
  with a real concurrent test, not predicted and left there — then the
  fixed version re-run against the identical test
- A short table or paragraph in `solution.md` naming which of the first
  three algorithms you'd actually pick for a login-attempt limiter vs. a
  public API's per-client quota, and why

### Constraints

- TypeScript throughout; `ioredis` (or the `redis` npm client) against
  the same Dockerized Redis from Day 4 — no need to stand up anything new
- Use a Lua script (`EVAL`) for any limiter whose check genuinely needs
  more than one atomic Redis primitive — don't fake atomicity with
  `MULTI`/`EXEC` where a watched key could still race
- Keep the limit small (5 per 10 seconds) so a burst test takes seconds,
  not minutes, to run

## Bonus round (optional)

- Implement a sliding-window *counter* (not log) — a weighted blend of
  the current and previous fixed window's counts — and compare its
  accuracy against the sliding window log's exact count, plus its memory
  cost (one or two integers vs. a growing sorted set) against it
- Key the limiter per simulated user id instead of globally, and prove
  two different keys never interfere — one user maxing out their limit
  shouldn't affect another's
- Return an actual `429` with a `Retry-After` header computed from
  whichever algorithm is active, and write a tiny client that backs off
  correctly when it sees one

## Resources

- https://redis.io/glossary/rate-limiting/
- https://stripe.com/blog/rate-limiters
- https://en.wikipedia.org/wiki/Token_bucket
- https://redis.io/docs/latest/develop/interact/programmability/eval-intro/

---

Once you've built something, write up `solution.md` in this folder using
`../_template/solution.md` as a starting point.
