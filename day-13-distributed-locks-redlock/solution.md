# Day 13 — Solution: Distributed Locks with Redis (Redlock)

**Blog post:** <link, once published>
**LinkedIn post:** <link, once shared>

## Setup

```
docker compose up -d                       # redis on 6379 (Parts 1-4)
docker compose --profile redlock up -d     # + 6380..6383 (Part 5)

cd src
npm run part1            # Part 1 — 5 workers x 20 increments, WITH the lock
npm run part1:nolock     # Part 1 — same, no lock (lost updates)
npm run part2            # Part 2 — TTL expires while the holder is still working
npm run part3            # Part 3 — plain DEL vs Lua compare-and-delete release
npm run part4            # Part 4 — fencing tokens
npm run part5            # Part 5 — Redlock; run with 5, 3, then 2 instances up
```

## Approach

I wrote a first single-instance lock myself (`lock.ts`: `SET key token NX PX ttl`,
Lua compare-and-delete release) and then built `redisLock.ts` as the reusable
version of the same idea — resource and TTL as parameters, `acquire` with retry
and jitter, a UUID token inside a `Lock` object so `release(lock)` can't be
called with someone else's token. Every later part builds on that file, and
each part is built to *break* the lock on purpose before showing what fixes it:
Part 1 shows why a lock is needed, Parts 2-3 show how a lock fails, Part 4 is
the fix for the part a lock can't fix by itself, Part 5 is what you do when one
Redis is a single point of failure.

## Key concepts learned

- **Without a lock, concurrent read-modify-write loses most of its updates —
  and the number is predictable.** 5 workers x 20 increments, each doing
  `GET`, a random 0-10ms pause, `SET current+1`:

  ```
  mode:        WITH lock
  expected:    100
  final value: 100
  lost updates: 0
  locks that expired before release: 0
  elapsed:     956ms

  mode:        NO lock
  expected:    100
  final value: 23
  lost updates: 77
  elapsed:     149ms
  ```

  77 of 100 increments lost. The final value (23) is close to one worker's 20
  increments, not "a bit under 100": all five workers read the same value
  before anyone writes back, so each round of five concurrent increments
  advances the counter by about one. The lock cost ~6x the time (956ms vs
  149ms) — that is exactly what mutual exclusion costs, since the workers now
  take turns.

- **A TTL lock does not guarantee exclusion — it guarantees the lock *goes
  away*, whether or not the holder is finished.** A takes a 1s lock and
  stalls for 2s inside the critical section:

  ```
  +   10ms  [A] acquired lock (ttl 1000ms)
  +   10ms  [A] ENTER critical section (inside = 1)
  + 1041ms  [B] acquired lock
  + 1042ms  [B] ENTER critical section (inside = 2)
  + 1043ms  [!!!] two workers are inside the critical section at once
  + 2010ms  [A] LEAVE critical section (inside = 1)
  + 2015ms  [A] release() -> false  (lock was no longer mine — TTL had expired)
  + 2056ms  [obs] after A's release attempt, lock key is STILL HELD (by B)
  + 2544ms  [B] LEAVE critical section (inside = 0)
  + 2546ms  [B] release() -> true
  Total time with 2 workers inside the critical section: ~967ms
  ```

  Two workers inside the critical section for ~967ms and no error anywhere.
  Redis did exactly what it was told. A's late `release()` correctly returned
  `false`, and B's lock survived — the token check did its job, but it can only
  protect the lock *key*, not the work A was doing.

- **Releasing with a plain `DEL` makes it worse — one stale release unprotects
  everyone.** Same stall, two release strategies, identical timeline:

  ```
  === NAIVE release ===
  +    9ms  [A] acquired (ttl 1s), working 2s
  + 1024ms  [B] acquired (took over after A's TTL expired), working 2s
  + 2015ms  [A] release -> true   <-- A deleted a lock it did NOT own
  + 2303ms  [C] acquired  <-- while B is STILL working
  + 3029ms  [B] release -> false

  === SAFE release ===
  +    1ms  [A] acquired (ttl 1s), working 2s
  + 1006ms  [B] acquired (took over after A's TTL expired), working 2s
  + 2005ms  [A] release -> false
  + 2303ms  [C] denied (B's lock is intact)
  + 3010ms  [B] release -> true
  ```

  Naive: A's `DEL` deleted B's lock, C walked in while B was still working,
  and then B's own release returned `false` because C's release had already
  removed the key — one stale `DEL` left both B and C unprotected. Safe (Lua
  compare-and-delete): A's release returns `false`, C is denied, B releases
  its own lock normally. The only difference is one ownership check inside
  the release script.

- **Fencing tokens fix what the lock can't: the resource refuses stale
  writers.** Part 2's stall again, but every acquire also returns a number
  from `INCR`, and the protected resource rejects any write with a lower
  number than it has already seen:

  ```
  === WITHOUT fencing ===
  + 1024ms  [B] acquired lock, fence token 2
  + 1226ms  [store] accepted write from B (fence 2) -> value = "written by B"
  + 2015ms  [A] woke up, still believes it holds the lock — writing
  + 2015ms  [store] accepted write from A (fence 1) -> value = "written by A"
  + 2022ms  FINAL VALUE: "written by A"

  === WITH fencing ===
  + 1224ms  [store] accepted write from B (fence 2) -> value = "written by B"
  + 2005ms  [A] woke up, still believes it holds the lock — writing
  + 2006ms  [store] REJECTED write from A (fence 1 < highest seen 2)
  + 2009ms  FINAL VALUE: "written by B"
  ```

  Without fencing, A — which lost its lock a full second earlier — overwrote
  B's newer data. With fencing, the same write is rejected. The lock service
  has no way to interrupt a stalled client; the only place the stale write can
  be stopped is the resource itself.

- **Redlock tolerates losing a minority of instances — and the arithmetic
  stops two clients from both winning.** 5 independent Redis instances,
  quorum 3, run with 5, 3 and 2 instances up:

  ```
  Reachable instances: 5/5   -> A: 5/5 votes, HOLDS (validity 4947ms)
                                B: 0/5 votes, denied
                                C: 5/5 after A's release
                                split vote: X holds 2, Y gets 3 and wins

  Reachable instances: 3/5   -> A: 3/5 votes, HOLDS (validity 4947ms)
                                B: 0/5 votes, denied
                                C: 3/5 after A's release

  Reachable instances: 2/5   -> A: 2/5 votes, FAILED to get a majority
                                B: 2/5 votes, also fails
  ```

  With 3 of 5 up the lock still works; with 2 of 5 it fails closed. B getting
  2/5 right after A's failed attempt also shows A's cleanup worked — A's two
  partial locks were released, not left behind to block everyone until they
  expired. And because every client needs 3 of 5 and 3 + 3 > 5, two clients
  can never both hold a majority — the split-vote case (X holds 2, Y wins
  with the other 3) shows that directly.

  The validity time (`ttl - elapsed - drift` = 5000 - 1 - 52 = ~4947ms) is the
  window you may safely work in, not the TTL. Redlock still doesn't fix Part
  2: a holder that stalls past its validity time is in the same situation
  as A. That is the core of the Kleppmann-vs-antirez debate — Redlock's
  safety rests on timing assumptions (bounded delays, bounded clock drift),
  and its random token isn't a fencing token. For "efficiency only" locks
  (avoid doing the same job twice) that's fine; for correctness, you want
  fencing from the resource anyway.

### Which approach for which job

| Situation | Pick | Why |
| --- | --- | --- |
| Avoid duplicate work (cron on N servers, cache stampede) — a rare overlap is only wasteful | Single-instance `SET NX PX` + Lua release | Cheap, simple; the worst case is doing the work twice |
| Correctness matters (money, inventory, a shared file) | Lock **plus fencing tokens** checked by the resource | Part 4: the only thing that stops a stale holder's write |
| Need the lock to survive an instance failure | Redlock (5 independent instances) — and still fence | Part 5: tolerates 2 of 5 down, but not a stalled holder |
| Data already lives in Postgres | Advisory locks / row locks (`SELECT ... FOR UPDATE`) | Lock lifetime tied to the transaction/connection; no TTL to outlive |
| Work can be made idempotent | Idempotency keys or a queue with one consumer per key | Often removes the need for a distributed lock entirely |

## Code walkthrough

- `src/lock.ts` — my original single-instance lock; left untouched.
- `src/redisLock.ts` — reusable `tryAcquire` / `acquire` / `release`; UUID
  token, retry with jitter, Lua compare-and-delete release.
- `src/part1-counter.ts` — shared counter, 5 workers x 20 increments,
  `--no-lock` flag for the broken run.
- `src/part2-ttl-expiry.ts` — 1s TTL, 2s stall, overlap detector with
  millisecond timestamps.
- `src/part3-wrong-owner.ts` — same stall, run twice: plain `DEL` release vs
  the Lua release, with a third worker (C) as the witness.
- `src/part4-fencing.ts` — acquire + `INCR` in one Lua script; an in-memory
  resource that rejects writes with a lower fence token.
- `src/part5-redlock.ts` — 5 fail-fast `ioredis` clients, 100ms per-instance
  timeout, quorum + validity-time check, release-on-all after a failed
  attempt, plus a split-vote demo.

## Gotchas / things that tripped me up

- **The token in my first lock can collide.** `token_${workerName}_${Date.now()}`
  is only unique if no worker builds two tokens in the same millisecond;
  release safety depends entirely on tokens being unique, so `redisLock.ts`
  uses `randomUUID()`.
- **Acquire and `INCR` must be one atomic step.** If the fencing token comes
  from a separate `INCR` after the `SET`, a worker that stalls between the two
  calls past the TTL can end up with the *lower* token while the newer holder
  gets the higher one — the exact inversion fencing is meant to prevent.
  Part 4 does both inside one Lua script.
- **A failed Redlock attempt has to release on every instance, including
  ones that never replied** — a timed-out `SET` may still have been applied.
  And the per-instance timeout has to be tiny compared to the TTL, or one
  dead node eats the lock's whole lifetime before you know the vote count.
- **`docker compose --profile redlock up -d` failed on port 6379**
  ("port is already allocated") because something else was already bound to
  it — most likely a Redis container left over from an earlier day. Part 5
  still saw 5/5 instances (the other Redis answered on 6379), but that one
  isn't part of this compose project, so `docker compose down -v` won't
  remove it. `docker ps --filter publish=6379` shows what's holding the port.
- **The no-lock result is far worse than "a few lost updates" (23 of 100, not
  somewhere in the 80s).** Obvious in hindsight — five workers racing each
  other overwrite each other's writes almost every round.
  <TODO: compare with the prediction you wrote in part1-counter.ts>

## What I'd do differently

<TODO: your own words — e.g. add the Part 1 bonus (a watchdog that extends the
TTL while the holder is alive) and prove it with `kill -STOP`; retry with
jitter at 20 workers instead of 5 and measure the fairness; compare against
a Postgres advisory lock for the same counter; or ask whether the counter
should have needed a lock at all — a single atomic `INCR` (Day 12's lesson)
would have solved Part 1 in one line.>

## Further reading

- https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/
- https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html
- http://antirez.com/news/101
- https://redis.io/docs/latest/commands/set/
