# Day 13 — Distributed Locks with Redis (and Redlock)

**Difficulty:** Advanced
**Tech stack:** Node.js, TypeScript, Redis (reusing Days 4 and 12's setup)
**Estimated time:** 3-4 hours

## Why this matters

Day 12 ended on a race condition: two steps that were each atomic on their
own, with a gap between them that concurrent callers fell straight
through. A distributed lock is the tool people reach for when the
critical section is bigger than anything a single Redis command or Lua
script can cover — "only one worker may run this nightly job," "only one
process may rewrite this file," "only one request may charge this card."
It is also one of the most reliably misimplemented patterns in
distributed systems, and one of the few topics where the algorithm's own
author and a well-known distributed-systems researcher publicly disagreed
about whether it is safe at all. That makes it a very good interview
topic, and a very good thing to break with your own hands before you trust it.

## Learning objectives

By the end of today you should be able to:

- Implement a single-instance Redis lock with `SET key token NX PX ttl`
  and show it gives mutual exclusion between two competing workers
- Break it on purpose: let the lock's TTL expire while the first holder
  is still working, and show two workers inside the critical section at
  the same time, both believing they hold the lock
- Show why releasing with a plain `DEL` is wrong — one worker deleting a
  lock that now belongs to someone else — and fix it with a unique token
  checked and deleted atomically in a Lua script (Day 12's lesson, reused)
- Implement a fencing token and show it protects a shared resource even
  when the lock itself fails, which is the one thing a TTL-based lock
  cannot promise on its own
- Implement Redlock across several independent Redis instances: acquire
  on a majority, account for elapsed time and clock drift, and show what
  happens when a minority and then a majority of instances go down
- Explain, in your own words, why Redlock is still contested, and what
  the critique actually says

## The challenge

Build a small `lock.ts` library and a set of scripts that fight over one
shared resource: a counter stored in a file (or a second Redis key) that
workers read, sleep briefly, increment, and write back. Without a lock,
that read-sleep-write is a lost-update machine, which is exactly what
makes it a good test subject.

**Part 1 — the happy path.** Implement `acquire(resource, ttlMs)` using
`SET lock:<resource> <random token> NX PX <ttlMs>`, and `release` as a
plain `DEL` for now. Run 5 workers, each incrementing the shared counter
20 times inside the lock. Confirm the final value is exactly 100. Then
run it once more with the lock removed and record how many updates were
lost. Write down your prediction for that number first.

**Part 2 — the TTL expires under you.** Give each worker a critical
section that sometimes takes longer than the lock's TTL (simulate a slow
call or a long GC pause with a plain `sleep`). With a 1-second TTL and a
2-second pause inside the lock, run two workers and log timestamps for
"acquired," "entered critical section," and "left critical section."
Confirm, from the log and not from reasoning, that both were inside the
critical section at the same time. Predict first whether the lock will
notice, or whether anything will tell worker A it lost the lock.

**Part 3 — releasing someone else's lock.** Reproduce this exact
sequence: worker A acquires and its TTL expires; worker B acquires the
now-free lock; worker A finishes and calls `release`. With the plain
`DEL`, A deletes B's lock, and a third worker C walks straight in while B
is still working. Prove it with a log. Then fix `release` so it only
deletes the key if its value still equals A's own token, done as a single
Lua script (`if redis.call('get', KEYS[1]) == ARGV[1] then return
redis.call('del', KEYS[1]) else return 0 end`), and re-run the same
sequence to show B's lock survives A's late release.

**Part 4 — fencing tokens.** Add a monotonically increasing token handed
out with every successful acquire (a Redis `INCR` on a sibling key
works). Make the shared resource itself remember the highest token it has
accepted, and reject any write carrying a lower one. Re-run Part 2's
overlapping-holders scenario and show that, although both workers believed
they held the lock, the stale worker's write is refused by the resource.
This is the part that actually saves the data.

**Part 5 — Redlock.** Start 5 independent Redis instances (five
`redis-server --port 6379..6383` processes or five containers; these must
be independent, not a replicated cluster). Implement acquire as: record
the start time, try `SET NX PX` on every instance with a short per-instance
timeout, count successes, compute elapsed time, and treat the lock as held
only if a majority (3 of 5) succeeded and the remaining validity
(`ttl - elapsed - drift`) is still positive. Otherwise release on every
instance. Then run three experiments and log each: all 5 up; 2 down (lock
should still be acquirable); 3 down (lock must fail). Write down what you
expect before each one.

**Part 6 — put it together in solution.md.** Write up, from what you
observed today, what each mechanism does and does not protect against:
a single-instance lock, a token-checked release, a fencing token, and
Redlock. Include one paragraph on why the Redlock debate exists (see the
two linked posts in Resources) and where you land after having broken a
TTL-based lock yourself.

### Requirements

- A working single-instance lock with unique-token acquire and
  Lua compare-and-delete release
- The lost-update count from Part 1 without a lock, measured, not guessed
- Part 2's overlapping critical sections actually observed in a
  timestamped log
- Part 3's wrong-owner release actually triggered, then fixed with the
  Lua script and re-run against the identical sequence
- A fencing token enforced by the resource itself, with a rejected stale
  write shown in the output
- A Redlock implementation across 5 independent Redis instances, run
  with 5, 3, and 2 instances reachable
- `solution.md` written from real output, including the predictions you
  made and whether they held

### Constraints

- TypeScript; `ioredis` against local instances, reusing the Dockerized
  or local Redis setup from Days 4 and 12 wherever you can
- Do not use an existing Redlock library for the core algorithm; read
  one after you have your own version working if you want to compare
- Use Lua for any release or check that needs more than one Redis call
- Use real wall-clock sleeps for the pause scenarios rather than mocking
  time, so the TTL expiry is a real event

## Bonus round (optional)

- Add a lock-extension loop (a "watchdog") that renews the TTL while the
  holder is alive, and show that it fixes Part 2's slow-worker case but
  does not fix a worker that is frozen outright (a process paused with
  `kill -STOP` and resumed later is a good stand-in for a GC pause)
- Add retries with jitter to `acquire` and measure how contention behaves
  with 20 workers instead of 5
- Compare against a Postgres advisory lock (`pg_advisory_lock`) for the
  same counter experiment, and note which failure modes the database
  gives you for free and which it does not
- One paragraph: when would you reach for a lock at all, versus making the
  operation idempotent or moving it behind a queue like Days 7-9?

## Resources

- https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/
- https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html
- http://antirez.com/news/101
- https://redis.io/docs/latest/commands/set/

---

Once you've built something, write up `solution.md` in this folder using
`../_template/solution.md` as a starting point.
