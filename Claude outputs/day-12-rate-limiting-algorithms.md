---
title: "Day 12 — Every Single One Got Through"
date: "2026-10-03"
excerpt: "Four rate limiters, one shared Redis instance. The fixed window's boundary flaw was exactly as advertised — but the race condition I built on purpose was worse than predicted: not a few requests over the limit, all twenty."
tags: ["30-day-challenge", "day-12", "rate-limiting", "redis", "typescript", "nodejs"]
draft: true
---

Day 4 put Redis in front of a cache. Day 12 puts it in front of a limit —
four different algorithms for "too many requests," all backed by the
same Redis instance, built specifically to watch them behave differently
under the same traffic instead of taking any of their tradeoffs on faith.
Reaching for a rate-limiting middleware package would have hidden exactly
the part worth seeing.

## The boundary trick, proven twice

A fixed window counter is the obvious first implementation: increment a
key scoped to the current 10-second window, compare against the limit.
One Redis `INCR`, atomic, correct. Its famous flaw isn't a bug in that
counter at all — it's what happens at the seam between two windows. Five
requests right before a boundary, five more right after:

```
17:02:49.703 request A5 -> ALLOWED
17:02:50.306 request B1 -> ALLOWED
...
RESULT: 10/10 requests allowed within ~1.2s, against a configured limit of 5 per 10s
```

Ten requests, about 600 milliseconds apart, against "5 per 10 seconds."
Not a race condition — every individual `INCR` was perfectly correct.
The two batches just landed in two different, independently-counted
windows.

Ran the *exact same* burst — same timing, same limit, same key shape —
against a sliding window log instead, which measures "the last 10
seconds" from each request's own clock rather than from a calendar-
aligned boundary:

```
17:02:59.705 request A5 -> ALLOWED
17:03:00.308 request B1 -> DENIED
...
RESULT: 5/10 requests allowed within ~1.2s, against a configured limit of 5 per 10s
```

Exactly 5 of 10. Same inputs, opposite outcome, because there's no
boundary left for a burst to straddle — just an exact count of timestamps
within a rolling window.

## A burst that's supposed to happen

Token bucket is the one algorithm today where "allows a burst" is the
feature, not a flaw. Capacity 5, refill rate 1 token every 2 seconds:
five immediate requests drained the bucket in under a millisecond, the
6th was denied outright, and after waiting 2.2 seconds — enough time to
regenerate about one token — exactly one more request got through before
the next was denied again. A client that's been idle long enough to
refill legitimately gets to burst up to capacity. That's the actual
design behind every "burstable" API quota you've ever hit.

## The race that let everyone in

The last piece was the one built to fail on purpose, and it failed
harder than I expected going in. The obvious-looking way to check a
limit: read the current count, compare it to the limit in your own
application code, increment only if you're still under. Fire 20
concurrent requests at it, with a limit of 5:

```
naive counter allowed 20/20 requests (configured limit: 5) — RACE CONDITION CONFIRMED
```

Not a handful over. All twenty. `Promise.all` fires all 20 reads in the
same tick, and every single one of them gets back the same pre-increment
count before any of their own writes has landed — every caller
independently concludes it's "the 1st request" or close to it, and every
caller is wrong in exactly the same way at exactly the same time. The
fix is one line: swap the read-then-check-then-write for a single atomic
`INCR`, and decide from the number it hands back instead of a value read
a moment earlier.

```
atomic counter allowed 5/20 requests (configured limit: 5) — CORRECT
```

Exactly 5, every time this was re-run. No partial credit for "mostly
atomic" — either the whole decision happens in one indivisible operation
or it doesn't, and the gap between "almost" and "actually" turned out to
be the entire limit.

## Which one would I actually reach for

Not every algorithm is right for every job, and today made the
difference concrete instead of theoretical: a login-attempt limiter
wants the sliding window log's exact, boundary-proof cap — you don't want
"5 attempts" to quietly mean "10, split across the right two seconds."
A public API's per-client quota wants the token bucket, because real
clients burst sometimes and a hard sliding-window cap would flag normal
usage as abuse. A high-traffic endpoint where the limit is "10,000/min"
rather than "5 ever" can live with the fixed window's cheaper storage —
one integer instead of a growing sorted set — because the boundary flaw
matters far less at that scale.

## What's next

Day 13 moves to distributed locks with Redis — `SETNX`, lease expiry, and
the specific ways a naive implementation lets two processes both believe
they hold the same lock at once. Full code in the
[repo](#) — `day-12-rate-limiting-algorithms/`.
