---
title: "Day 1 — Begin with the Basics: Bun vs Node.js"
date: "2026-09-22"
excerpt: "Kicking off a 30-day challenge to learn one new piece of the stack a day, starting with Bun vs Node.js — three self-inflicted server crashes, and what 'cold start' actually means."
tags: ["30-day-challenge", "day-01", "bun", "nodejs", "typescript", "performance"]
draft: true
---

## Why a 30-day challenge

I'm starting a 30-day challenge: one new piece of the tech stack, learned and
actually implemented, every single day. Not tutorials followed along with —
small working things, built from scratch, with the code public.

The reasoning is simple. I've spent 7+ years mostly in Node.js and React,
and it's easy to get comfortable inside that lane. This is a forcing
function to go wide across the rest of the stack — messaging systems,
databases, cloud infrastructure, the current AI tooling — and to have
something concrete to point to in an interview instead of a bullet point
that says "familiar with Kafka."

The rules I'm holding myself to:

- One folder per day in a [public GitHub repo](#), starting basic and
  working up to advanced by the end of the month.
- Every day ships a `challenge.md` (the brief) and a `solution.md` (what I
  actually found), plus the working code.
- Every day gets a blog post and a LinkedIn post. Making it public is the
  point — it's a lot harder to quietly skip a day when it's going to show
  up (or not show up) on LinkedIn.

Day 1 is deliberately basic: Bun vs Node.js.

## The challenge

Build the same small REST API twice — once on Node using only `node:http`
(no Express, no framework — the point is comparing runtimes, not
frameworks), once on Bun using `Bun.serve`. Same three routes on both:

- `GET /health` → `{ status: "ok" }`
- `GET /todos` → the in-memory todo list
- `POST /todos` → append a todo, return the created item with a generated id

Then compare cold start, and write down what's actually different about
building the same thing on each.

## The code

**Bun** — `Bun.serve` with a `routes` object:

```ts
const todos: todoType[] = [];

const server = Bun.serve({
  routes: {
    "/health": () => Response.json({ status: "ok" }),
    "/todos": {
      GET: () => Response.json({ todos: todos }),
      POST: async (req) => {
        const body = (await req.json()) as reqBody;
        const title = body.title;
        let newId = todos[todos.length - 1]?.id ?? 0;
        newId++;
        todos.push({ id: newId, title });
        return Response.json({ id: newId, title });
      },
    },
  },
});
```

**Node** — `http.createServer` with manual routing:

```ts
const todos: todoType[] = [];

const server = http.createServer(async (req, res) => {
  if (req.url === "/health") {
    res.statusCode = 200;
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (req.url === "/todos") {
    if (req.method === "GET") {
      res.statusCode = 200;
      res.end(JSON.stringify({ todos }));
      return;
    }
    if (req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk.toString()));
      req.on("end", () => {
        const title = JSON.parse(body).title;
        let newId = todos[todos.length - 1]?.id ?? 0;
        newId++;
        todos.push({ id: newId, title });
        res.statusCode = 200;
        res.end(JSON.stringify({ id: newId, title }));
      });
    }
  }
});

server.listen(3001);
```

Same routes, same response shapes, noticeably different amount of code and
a noticeably different amount of API surface to already know about.

## How Bun and Node actually differ here

The headline difference: **Bun ships fetch-standard `Request`/`Response`
objects as first-class server primitives.** `req.json()`, `Response.json()`
— they just work, built into the runtime. Node's `http.createServer` hands
you a raw readable stream and a response you write to manually. Nothing
parses anything for you.

I didn't appreciate how real that gap was until the Node version crashed on
me three separate times while I was building what I thought was the
"equivalent" implementation:

1. First pass copy-pasted Bun's `routes`-object shape straight into
   `http.createServer()`. It's simply not a valid argument there — the
   server started, accepted connections, and never responded to a single
   one of them.
2. Fixed that with a real `(req, res)` listener, but left in `req.json()` —
   which doesn't exist on Node's `IncomingMessage`. Every `POST` threw
   `TypeError: req.json is not a function` and took the whole process down
   with it (an uncaught error inside an `async` handler is an unhandled
   rejection, not just a failed request).
3. Buffered the body correctly with `req.on("data", ...)`, but parsed it
   immediately after registering that listener — before any bytes had
   actually arrived. `JSON.parse("")` on an empty string, same crash.

None of these are Node bugs. They're just what the raw API looks like, and
Bun's `routes` API is deliberately hiding that complexity behind an
interface that already matches the Fetch standard. If you've only ever
built HTTP servers through Express or a framework, this is the layer you
never usually see — and it's a fair chunk of *why* Bun feels faster to
build with, independent of runtime performance.

The other concrete difference: **native TypeScript execution.** Bun runs
`.ts` files directly, no separate build step. Getting a fair equivalent out
of Node meant either its own (newer, and noisier — it warns on every run
right now) type-stripping, an explicit `tsc` compile step, or a transpiler
like `tsx` in dev.

None of this makes Node the "wrong" choice. Node's ecosystem maturity is
real — production tooling, observability integrations, and a large slice of
npm assume Node's exact runtime semantics, and Bun's compatibility layer
covers most of that but not all of it (I hit a platform-specific binary
issue with TypeScript's newer native compiler mid-way through this exact
post). For a net-new side project or a CLI tool, Bun's DX and startup speed
are hard to argue with. For an existing production Node fleet, a migration
has to earn its keep against real pain, not hypothetical speed.

## The numbers

"Cold start" is harder to measure honestly than it looks. An internal
`Date.now()`/`performance.now()` delta around your own server-binding code
only captures the last step — it misses the runtime booting, your module
being resolved, and (for TypeScript) being type-stripped or transpiled,
all of which happen *before* your first line of code runs. And `time` on a
long-running server doesn't help either, since the process never exits on
its own — `real` just ends up measuring however long you happened to leave
it running before killing it.

What actually works: read `performance.now()` — which is relative to
`performance.timeOrigin`, roughly the moment the process started — as the
very first thing your script does. That number alone is a solid proxy for
true cold start.

| Runtime | Warm run | Notes |
|---|---|---|
| Bun, native `.ts` | ~2ms | after the first (cold-cache) run |
| Node, precompiled `.js` via `tsc` | ~23ms | fair apples-to-apples, no transpiler in the loop |
| Node, `npx tsx` (dev-mode TS) | ~110-166ms | includes `npx` resolution + esbuild startup, not just Node |

Bun's runtime starts roughly **11x faster** than Node running precompiled
JS. Reaching for `tsx` instead of precompiling adds **another 5-7x** on top
of that — and that gap belongs to the transpiler, not to Node itself. Two
separate, honest findings, not one "Bun crushes Node" headline.

Idle CPU footprint (from `time`, same servers left running) also came out
lopsided — Bun sat around ~0.06% average CPU, Node around ~12% — though my
two sample runs were very different lengths, so I'm treating that one as
directional until I re-run it under equal conditions.

Throughput under real load (`autocannon` against `GET /todos`) is still on
my list for this one — I'll fold it in once it's run rather than guess at
the number.

## What's next

Day 2 moves to runtime validation with Zod. Full write-up, code, and
benchmarks for today are in the [repo](#) — `day-01-bun-vs-node/`.
