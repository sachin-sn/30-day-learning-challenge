---
title: "Day 13 — The Lock Expired and Nobody Noticed"
date: "2026-10-04"
excerpt: "Built a Redis lock, then spent the day breaking it. Without it, 77 of 100 increments vanished. With it, two workers still ended up inside the critical section for a full second — and nothing raised an error."
tags: ["30-day-challenge", "day-13", "distributed-locks", "redis", "redlock", "typescript", "nodejs"]
draft: true
---

Day 12 ended on one idea: a decision that spans more than one Redis call
has to happen inside one indivisible operation, or concurrent callers
will walk straight through the gap. Day 13 asks the same question one
level up. What if the thing that has to be exclusive isn't a single
command — it's a whole stretch of work, done by separate processes that
don't share memory? That's a distributed lock, and the interesting part
of building one turned out to be everything it doesn't promise.

## First, why you'd want one

Five workers, 20 increments each, on a shared counter. Each increment is
a read, a random 0–10ms pause, then a write of "what I read plus one" —
the shape of any real read-modify-write. Expected total: 100.

```
mode:        WITH lock
expected:    100
final value: 100
lost updates: 0
elapsed:     956ms

mode:        NO lock
expected:    100
final value: 23
lost updates: 77
elapsed:     149ms
```

77 of 100 increments gone — not a few slipping through, most of them. The final value is close to what *one* worker
would have produced alone, because all five read the same number before
anyone wrote back, so each round of five increments moved the counter by
about one. The lock cost roughly six times the runtime — the workers now
take turns — and that's the whole price of getting 100.

## The lock is one command

`SET key token NX PX ttl` — set only if absent, with an expiry, in one
atomic step. Release is a small Lua script: delete the key only if it
still holds *my* token. The token matters more than it looks. A plain
`DEL` lets you delete a lock someone else now owns, and the day's second
half is about exactly that.

## The lock expires; the work doesn't

The TTL exists so a crashed holder doesn't block everyone forever. It
doesn't know whether the holder crashed or is just slow. Worker A takes a
1-second lock and then stalls for 2 seconds inside the critical section —
a GC pause, a slow downstream call, anything:

```
+   10ms  [A] acquired lock (ttl 1000ms)
+   10ms  [A] ENTER critical section (inside = 1)
+ 1041ms  [B] acquired lock
+ 1042ms  [B] ENTER critical section (inside = 2)
+ 1043ms  [!!!] two workers are inside the critical section at once
+ 2010ms  [A] LEAVE critical section (inside = 1)
+ 2015ms  [A] release() -> false  (lock was no longer mine — TTL had expired)
```

About 967 milliseconds with two workers inside a section that's supposed
to hold one, and not a single error anywhere. Redis did exactly what it
was told. A's late release correctly returned `false` and B's lock
survived, so the ownership check worked — but it protects the lock key,
not the work A was in the middle of.

## One stale DEL unprotects everyone

Same stall, but A releases with a plain `DEL` instead of the ownership
check, and a third worker C shows up at 2.3 seconds:

```
=== NAIVE release ===
+ 2015ms  [A] release -> true   <-- A deleted a lock it did NOT own
+ 2303ms  [C] acquired  <-- while B is STILL working
+ 3029ms  [B] release -> false

=== SAFE release ===
+ 2005ms  [A] release -> false
+ 2303ms  [C] denied (B's lock is intact)
+ 3010ms  [B] release -> true
```

A deletes B's lock, C walks in while B is mid-work, and by the time B
releases, C has already removed the key — B's release returns `false`.
One stale delete left two workers unprotected. With the Lua check, the
identical timeline ends with A refused, C denied, and B releasing its own
lock normally. The entire difference is one comparison.

## The part a lock can't fix

Even with a perfect release, A and B still overlapped in Part 2. The lock
service has no way to reach into A and stop it — it can only forget the
lock. The place to stop A's late write is the thing being written to.

Fencing tokens do that. Every acquire also returns a number from an
`INCR` — it only ever goes up. Every write to the protected resource
carries that number, and the resource keeps the highest one it has seen
and rejects anything lower:

```
=== WITHOUT fencing ===
+ 1226ms  [store] accepted write from B (fence 2) -> value = "written by B"
+ 2015ms  [store] accepted write from A (fence 1) -> value = "written by A"
+ 2022ms  FINAL VALUE: "written by A"

=== WITH fencing ===
+ 1224ms  [store] accepted write from B (fence 2) -> value = "written by B"
+ 2006ms  [store] REJECTED write from A (fence 1 < highest seen 2)
+ 2009ms  FINAL VALUE: "written by B"
```

Without it, A — which lost its lock a full second earlier — overwrote
newer data from B. With it, the same write bounces. One detail I got
wrong in my first sketch: the token has to come from the *same* Lua
script as the lock acquisition. If it's a separate `INCR` afterwards, a
worker that stalls between the two calls can end up with the lower token
while the newer holder gets the higher one — which is the exact inversion
the whole scheme exists to prevent.

## Five Redis instances instead of one

A single Redis is a single point of failure. Redlock asks five
independent instances and only counts the lock as held if a majority —
three — agreed, with time left on the clock afterward. I ran it with all
five up, then three, then two:

```
Reachable instances: 5/5   A: 5/5 votes, HOLDS     B: 0/5, denied
Reachable instances: 3/5   A: 3/5 votes, HOLDS     B: 0/5, denied
Reachable instances: 2/5   A: 2/5 votes, FAILED    B: 2/5, also fails
```

Three of five up still works. Two of five fails closed, which is the
right way to fail. B getting 2/5 right after A's failed attempt also
confirms A's cleanup worked — a failed attempt has to release on every
instance, including ones that never replied, or its partial locks block
everyone until they expire. And because every client needs 3 of 5, and
3 + 3 is more than 5, two clients can never both hold a majority. I
checked that directly with a split vote: X already holds two instances, Y
races for all five, gets the other three, and wins.

The number it prints is the one to watch: `validity`, about 4947ms on a
5-second TTL. That's `ttl − elapsed − clock-drift allowance`, and it's
the window you can safely work in — not the TTL. A holder that stalls
past it is back in Part 2's situation. That's the heart of the old
Kleppmann-versus-antirez argument: Redlock's safety leans on timing
assumptions, and its token is random rather than increasing, so it can't
act as a fencing token on its own.

## Which one would I reach for

If a rare overlap only wastes work — a cron job on several servers, a
cache rebuild — a single-instance lock with the Lua release is plenty, and
cheap. If it can corrupt something — money, stock counts, a shared file —
the lock needs fencing checked by the resource, whichever lock sits in
front of it. Redlock is for when losing one Redis can't stop the system
from locking, and it still wants fencing next to it. And if the data
already lives in Postgres, an advisory lock or `SELECT … FOR UPDATE` ties
the lock's lifetime to the transaction, so there's no TTL to outlive.
Sometimes the better answer is making the work idempotent so you don't
need the lock at all — and Part 1's counter is a good example, since a
single atomic `INCR`, straight out of Day 12, would have solved it in one
line.

## What's next

Day 14 moves to Infrastructure as Code — Terraform or Pulumi — describing
the kind of setup I've been running by hand in `docker-compose.yml` as
something that can be reviewed, versioned and repeated. Full code in the
[repo](#) — `day-13-distributed-locks-redlock/`.
