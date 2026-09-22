# Day 1 — Bun Runtime vs Node.js

**Difficulty:** Beginner
**Tech stack:** Bun, Node.js, plain HTTP (no framework)
**Estimated time:** 1-2 hours

## Why this matters

Bun has moved from "interesting experiment" to something you'll see teams
actually shipping with in 2026 — its own HTTP server, bundler, test runner
and TS support with no separate build step. Before reaching for it (or being
asked about it in an interview), it's worth feeling the difference yourself
rather than taking benchmark blog posts at face value.

## Learning objectives

By the end of today you should be able to:

- Stand up an equivalent small REST API on both Node.js and Bun
- Explain concretely (not just "it's faster") what Bun's runtime does
  differently: its native `Bun.serve`, built-in `bun:test`, native TS
  execution, package manager
- Measure and compare cold-start time and simple request throughput between
  the two

## The challenge

Build the same small API twice — once on Node, once on Bun:

- `GET /health` → `{ status: "ok" }`
- `GET /todos` → returns an in-memory array of todo items
- `POST /todos` → appends a todo `{ title: string }` to the in-memory array,
  returns the created item with a generated id

Node version: use only `node:http` (no Express) so you're comparing runtimes,
not frameworks.
Bun version: use `Bun.serve`.

Then:

1. Time cold start for each (`time node index.js` vs `time bun index.js` —
   note when the server is actually ready to accept requests).
2. Run a simple load test against both (e.g. `autocannon` or `bombardier`)
   hitting `GET /todos` for 10-15 seconds and compare requests/sec.
3. Write down at least 3 concrete API/DX differences you noticed while
   building (not perf-related) — e.g. TypeScript running without a build
   step, built-in `.env` loading, `bun install` speed.

### Requirements

- Both servers implement the same three routes with the same response shapes
- Include a short `README.md` inside this folder's `src/` explaining how to
  run each version
- Capture your benchmark numbers (even rough ones) in `solution.md`

### Constraints

- No framework (no Express/Hono/Elysia) — the point is runtime, not framework
- Keep both implementations under ~100 lines each

## Bonus round (optional)

- Add a third version using Bun to run the *same* Node.js code unmodified
  (Bun's Node-compatibility mode) and see what, if anything, breaks
- Try `bun build --compile` to produce a standalone executable and note the
  binary size and startup time

## Resources

- https://bun.sh/docs/api/http
- https://nodejs.org/api/http.html
- https://bun.sh/docs/runtime/nodejs-apis (Node compatibility)

---

Once you've built something, write up `solution.md` in this folder using
`../_template/solution.md` as a starting point.
