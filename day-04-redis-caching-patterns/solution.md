# Day 4 — Solution: Redis Caching Patterns

**Blog post:** <link, once published>
**LinkedIn post:** <link, once shared>

## Approach

Wrapped the in-memory `todos` array behind `getTodosFromSource()`, which
awaits a 200ms artificial delay before returning — standing in for a real
database round trip, since every read through Days 1-3 has been instant
and that's not representative of anything real. Put Redis in front of it
as a cache-aside layer on `GET /todos`: check Redis first, and on a miss
fall through to the (slow) source, populate Redis with a 30s TTL, then
return. `POST /todos` (`todos.create`) invalidates the cache with
`redis.del()` so a write can't leave a stale list behind.

Every read now logs and returns which path it took (`hit`/`miss`) and how
long it took — the whole point of today was to end with real numbers
proving the cache actually helps, not just assuming Redis makes things
faster because it's Redis.

## Key concepts learned

- Cache-aside only works if the "slow path" is actually slow. Without the
  artificial delay in `getTodosFromSource()`, a cache hit and a cache miss
  would have been equally instant and there'd have been nothing to
  measure — the delay isn't just simulation flavor, it's what makes the
  whole exercise meaningful.
- A cache write needs to be awaited, not fire-and-forgotten. The same
  unhandled-rejection lesson from Day 1's Node crash applies here: if
  `redis.set()`/`redis.expire()` fails on a miss and nothing's waiting on
  it, that failure disappears silently instead of surfacing as a real
  error.
- Bun's native Redis client doesn't support ioredis-style inline
  expiry (`set(key, value, "EX", seconds)`) — TTL is a separate
  `.expire()` call after `.set()`.
- `redis.get()` on a missing key returns `null`/falsy, so checking its
  truthiness directly does the same job as a separate `redis.exists()`
  check, in one round trip instead of two.
- Invalidation and expiration are two different safety nets, not
  redundant: `del()` on write handles the common case immediately, and
  the TTL is what bounds the damage if an invalidation is ever missed
  somewhere else in the codebase.

## Benchmarks

Real `GET /todos` timings from a live run (Bun server + Docker-hosted
Redis, both on the same machine):

| Call | Path | Time |
|---|---|---|
| 1 | MISS (first request, cold) | 211.75ms |
| 2 | HIT | 1.46ms |
| 3 | HIT | 3.95ms |
| 4 | HIT | 0.85ms |
| 5 | MISS (after TTL/invalidation) | 205.31ms |
| 6 | HIT | 3.09ms |

Misses averaged **~208.5ms** (bounded by the 200ms simulated source
delay plus the cache write itself); hits averaged **~2.2ms** — roughly
**95x faster** on average, and up to ~250x on the fastest hit against the
slowest miss. The numbers land almost exactly where they should: a hit
never approaches the 200ms floor a miss is guaranteed to pay, because a
hit never touches the simulated source at all.

## Code walkthrough

- `src/bun/index.ts` — `getTodosFromSource()` (the simulated slow path),
  `cacheTodos()` (`set` + `expire`, both awaited), and the `GET /todos`
  handler that checks `redis.get()` first, times the whole thing with
  `performance.now()`, and logs/returns `source: "hit" | "miss"` plus
  `ms` on every response. `POST /todos` calls `redis.del(TODOS)` after
  pushing the new todo, so the next `GET` is guaranteed to reflect it
  instead of serving a stale cached list until the TTL happens to expire.

## Gotchas / things that tripped me up

**Code:**

1. First pass called `redis.set(TODOS, JSON.stringify(updatedTodos), "EX", 30)`
   — Bun's client doesn't support ioredis-style inline TTL args, so that
   `"EX", 30` was silently dropped and the cache never actually expired.
   Fixed with a separate `redis.expire(TODOS, 30)` call.
2. The cache-hit path returned `redis.get()`'s raw JSON string directly
   inside `Response.json({ todos: todosCache })` — a string field, not an
   array, so a hit and a miss returned differently-shaped payloads to the
   same caller. Fixed with `JSON.parse(todosCache)`.
3. The cache-populate call on a miss wasn't awaited — fixed to `await
   cacheTodos(freshTodos)` before responding, so a write failure can't
   become a silent unhandled rejection.

**Environment (the bigger time sink today):**

4. `RedisError: Connection closed` on first run — turned out `await
   redis.connect()` was failing before the server even started, because
   nothing was listening on `redis://localhost:6379` yet. No Redis had
   actually been started.
5. `brew install redis` failed outright — this machine is Intel x86_64,
   and Homebrew dropped Intel to "Tier 3" (best-effort, no guaranteed
   prebuilt bottles) in its 7.0.0 release this same month, so it fell
   back to compiling from source and hit a second, unrelated problem: the
   installed Xcode Command Line Tools were arm64-only on genuinely Intel
   hardware, so `xcrun` couldn't even load its own library.
6. Switched to Docker to sidestep native compilation entirely, but `docker`
   on `PATH` resolved to an unrelated npm-installed binary of the same
   name (`which docker` pointed into an nvm folder, not `/Applications`)
   — had to call Docker Desktop's real CLI by its full path instead of
   fighting the PATH order.
7. Once Docker Desktop was actually installed, `docker run redis` failed
   on `error getting credentials - docker-credential-desktop: executable
   file not found in $PATH` — the credential helper binary lives next to
   `docker` itself, but wasn't discoverable for the same PATH reason.
   Since a public image pull doesn't need stored credentials at all,
   removing the `"credsStore": "desktop"` line from `~/.docker/config.json`
   was the actual unblock.

## What I'd do differently

- Bonus round: think through the cache-stampede case — as written, N
  simultaneous requests landing right as `TODOS` expires would all
  independently miss and all independently hit the simulated source and
  rewrite the cache, rather than one request repopulating it for the
  rest. Worth a follow-up (e.g. a simple in-flight-request lock) even
  though the challenge only asked to reason about it, not fix it.
- Try the write-through variant: update the cache directly with the new
  state in `POST /todos` instead of `del()`-then-repopulate-on-next-read.
- Re-run the benchmark with more samples (10+ hits, several misses spaced
  across TTL boundaries) for a steadier average than six calls gives.

## Further reading

- https://bun.com/docs/runtime/redis
- https://redis.io/docs/latest/commands/expire/
- https://redis.io/docs/latest/develop/use/patterns/
