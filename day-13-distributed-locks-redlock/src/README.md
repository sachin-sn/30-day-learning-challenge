# Day 13 — Distributed locks with Redis (Redlock)

Start Redis (from the day-13 folder, one level up from `src/`):

```bash
docker compose up -d                       # Parts 1-4: one Redis on :6379
docker compose --profile redlock up -d     # Part 5: all five on :6379-6383
docker compose ps                          # shows each instance and its health
docker compose --profile redlock down -v   # stop and remove everything
```

Run from `src/`:

```bash
npm install
npm run part1          # 5 workers x 20 increments, with the lock
npm run part1:nolock   # same, no lock (lost updates)
npm run part2          # TTL expires while the holder is still working
npm run part3          # plain DEL vs Lua compare-and-delete release
npm run part4          # fencing tokens
npm run part5          # Redlock — run with 5, 3, then 2 instances up
```

Files: `lock.ts` (first single-instance lock), `redisLock.ts` (reusable
acquire/release), `redis.ts` (shared connection), `part1`..`part5` (one demo each).
