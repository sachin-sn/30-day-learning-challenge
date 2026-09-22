# Day 1 — Solution: Bun Runtime vs Node.js

**Blog post:** https://ch-ai.in/blog/day-01-begin-with-the-basics

## Approach

Built the same small REST API twice — `GET /health`, `GET /todos`, `POST
/todos` — once on Node using only `node:http`, once on Bun using
`Bun.serve`'s `routes` API. Both keep todos in memory as `{ id, title }`
objects with an incrementing id.

The Bun version worked close to first try. The Node version took three
passes to get functionally correct — see Gotchas below, since the bugs
along the way turned out to be the most useful part of the exercise.

## Key concepts learned

- Bun's `Bun.serve({ routes })` gives you fetch-style `Request`/`Response`
  objects as first-class server primitives — `req.json()`, `Response.json()`
  — built into the runtime. Node's `http.createServer` only ever accepts a
  plain `(req, res)` listener function; passing it a routes-style object is
  silently ignored, so nothing responds to anything.
- Node's `req` is a raw readable stream (`IncomingMessage`), not a parsed
  request. Getting a JSON body means buffering `'data'` chunks yourself and
  parsing only once `'end'` fires — parse too early and you're parsing an
  empty string.
- An uncaught error inside an `async` request handler doesn't just fail that
  one request in Node — it's an unhandled rejection that can take the whole
  process down. One bad `POST` crashed every route until restart.
- `time` measures wall-clock from process start to process _exit_. A
  long-running server never exits on its own, so `time bun index.ts` /
  `time node index.ts` just measures however long the process happened to be
  left running before it was killed — not startup latency. `real` is only
  meaningful here as a rough signal if you kill the process quickly and
  consistently; it's still not a precise cold-start number.
- `performance.now()` is relative to `performance.timeOrigin` (roughly
  process start), so a single call to it at the top of the script — logged
  before anything else runs — is a much closer proxy for true cold start
  than an internal start/end delta, which only brackets "bind the listener"
  and misses runtime boot + module load entirely.
- Even normalized per second of wall time, Bun's idle CPU footprint measured
  dramatically lower than Node's in one sample (~0.06% vs ~12% average CPU).
  Directionally interesting, but that sample's two runs were very different
  lengths (13s vs 149s), so it needs an equal-duration re-run to be a fair
  comparison rather than a one-off data point.

## Benchmarks

**Cold start — `performance.now()` at process entry** (time from runtime
boot to the first line of the script executing; all runs on the same
machine):

| Runtime                                       | Run 1    | Run 2    | Run 3    | Notes                                                                                         |
| --------------------------------------------- | -------- | -------- | -------- | --------------------------------------------------------------------------------------------- |
| Bun (`bun run index.ts`, native `.ts`)        | 16.57ms  | 2.05ms   | 2.25ms   | first run cold disk cache, runs 2-3 warm                                                      |
| Node (`node index.js`, precompiled via `tsc`) | 111.39ms | 23.55ms  | 23.12ms  | fair apples-to-apples — no `tsx`/esbuild in the loop                                          |
| Node (`npx tsx index.ts`)                     | 165.81ms | 129.70ms | 109.13ms | reference only — includes `npx` resolution + esbuild transpiler startup on top of Node itself |

Warm-run takeaway: Bun's runtime starts roughly **11x faster** than Node
running precompiled JS (~2ms vs ~23ms). Reaching for `tsx` instead of
precompiling adds another **5-7x** on top of that (~23ms vs ~110-166ms) —
that gap is the transpiler's cost, not Node's. Both are real, useful
findings, worth keeping as two distinct numbers in the write-up rather than
one "Node vs Bun" headline.

**Idle CPU** (`time` output; run durations differ — see caveat above):

| Runtime | real      | user   | sys    | CPU / sec of wall time |
| ------- | --------- | ------ | ------ | ---------------------- |
| Node    | 13.040s   | 1.101s | 0.484s | ~12.2%                 |
| Bun     | 2m28.977s | 0.028s | 0.056s | ~0.06%                 |

**Load test** (`GET /todos`, autocannon/bombardier, 10-15s): TODO

## Code walkthrough

- `src/bun/index.ts` — `Bun.serve({ routes: { "/health": ..., "/todos": { GET, POST } } })`.
- `src/node/index.ts` — `http.createServer(async (req, res) => {...})` with
  manual `req.url`/`req.method` branching and manual body buffering via
  `'data'`/`'end'`.

## Gotchas / things that tripped me up

1. First pass at the Node version copy-pasted Bun's `routes`-object shape
   straight into `http.createServer()`. It's not a valid argument there —
   the server accepted connections but never responded to any of them.
2. First fix wired up a real `(req, res)` listener but still called
   `req.json()`, which doesn't exist on Node's `IncomingMessage` — threw
   `TypeError: req.json is not a function` and crashed the process on every
   `POST`.
3. Second fix added `req.on("data", ...)` but read `body` synchronously
   right after registering the listener, before any data had actually
   arrived. `JSON.parse("")` threw `SyntaxError: Unexpected end of JSON
input` and crashed the process the same way.
4. Final fix moved the parse-and-respond logic inside the `'end'` handler,
   so it only runs once the whole body has actually arrived.

## What I'd do differently

- Run the load test against both.
- Re-run the idle-CPU comparison with both processes alive for the same
  fixed duration, to remove the run-length confound.
- Add error handling around the request listener so a malformed request
  returns a 400 instead of taking the whole server down.

## Further reading

- https://bun.sh/docs/api/http
- https://nodejs.org/api/http.html
- https://bun.sh/docs/runtime/nodejs-apis
- https://developer.mozilla.org/en-US/docs/Web/API/Performance/now
