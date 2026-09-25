---
title: "Day 4 — The Cache That Lied About Being Fast"
date: "2026-09-25"
excerpt: "Cache-aside with Bun's native Redis client. The code was the easy part — getting Redis running on a 2026 Intel Mac took longer than writing the feature."
tags: ["30-day-challenge", "day-04", "redis", "caching", "bun"]
draft: true
---

Day 3 made a client type-safe. Today's about a different kind of trust:
does the "source of truth" your code hits actually need to be hit every
time? Cache-aside says no — check the cache first, fall through to the
slow path only on a miss, and put what you found back for next time.

```ts
const cached = await redis.get(TODOS);
if (cached) return { todos: JSON.parse(cached), source: "hit" };

const fresh = await getTodosFromSource(); // artificial 200ms delay
await cacheTodos(fresh); // set + expire, awaited
return { todos: fresh, source: "miss" };
```

Two real bugs I found on first read, both self-fixed before I could:
`redis.set()` doesn't take an inline `"EX", 30"` like ioredis — Bun's
client wants a separate `redis.expire(key, seconds)` call, and it fails
silently rather than erroring, so the first version was caching forever.
The cache-hit path was also returning the raw JSON string instead of
`JSON.parse()`-ing it.

One I did fix: the cache write on a miss was fire-and-forget, no
`await`. Same failure mode as Day 1's unhandled rejection — if that write
ever throws, it takes the process with it instead of just failing one
request.

## The numbers

Six real requests, one after another:

| Type | Time |
|---|---|
| miss | 211.75ms |
| miss | 205.31ms |
| hit | 1.46ms |
| hit | 1.58ms |
| hit | 3.95ms |
| hit | 0.85ms |
| hit | 3.09ms |

Misses average ~208.5ms (the 200ms simulated delay plus the cache
write). Hits average ~2.2ms. That's roughly **95x faster** — and it's
the same code path, same data, the only difference is whether Redis had
seen the key before.

## Getting Redis running took longer than the code

This is the part worth writing down, because it's dated and I'd have
gotten it wrong from memory: `brew install redis` failed with `Bad CPU
type in executable`. My Mac is genuinely Intel x86_64, and Homebrew
7.0.0 — released this same month — dropped Intel to "Tier 3" support, no
guaranteed prebuilt bottles. That forced a from-source build, which then
hit a second, unrelated problem: arm64-only Xcode Command Line Tools on
real Intel hardware (`xcrun: unable to load libxcrun`).

Pivoted to Docker instead of fighting the toolchain. `docker run` then
returned garbage — turned out `which docker` was resolving to an
unrelated npm package on my PATH, not the real CLI, and Docker Desktop
wasn't even installed yet. After installing it and calling the real
binary by full path, the last blocker was a missing credential helper
(`docker-credential-desktop: executable file not found`) — fixed by
dropping `"credsStore": "desktop"` from `~/.docker/config.json`, since a
public `redis` pull needs no stored credentials at all.

None of that touched the actual lesson. It's just what "add caching to
your app" costs on a 2026 Intel Mac.

## What I'd do differently

More samples than six would make the average more honest, and I didn't
touch cache stampede — right now, N simultaneous misses trigger N
identical slow-path calls instead of one. A short-lived lock or an
in-flight promise map would collapse that to one.

## What's next

Day 5: DynamoDB single-table design. Full code in the
[repo](#) — `day-04-redis-caching-patterns/`.
