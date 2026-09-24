# Day 3 — Type-safe APIs with tRPC

**Difficulty:** Beginner-Intermediate
**Tech stack:** TypeScript, tRPC, Zod
**Estimated time:** 1.5-2.5 hours

## Why this matters

Day 2 made the *server* honest about what it accepts — bad input gets a
structured 400 instead of a crash. But the *client* calling that API is
still on the honor system: a plain `fetch("/todos", { method: "POST",
body: JSON.stringify(...) })` has no idea what shape the server expects
until the request actually goes out and either works or doesn't. The
response type is whatever you assert it to be, same problem as Day 1's
`as reqBody`, just moved to the other end of the wire.

tRPC closes that gap without a code-generation step: the client imports
the server's router *type* (not its implementation) and gets full
autocomplete and compile-time checking on every call — wrong argument
shape, typo'd procedure name, and mismatched return type all become red
squiggles in the editor, not runtime surprises. It's also the natural
next step after Day 2, since tRPC procedures take a Zod schema directly
as their input validator — the schemas you already wrote don't get
thrown away, they get reused as the contract.

## Learning objectives

By the end of today you should be able to:

- Define a tRPC router with `query` (read) and `mutation` (write)
  procedures
- Wire a Zod schema straight into `.input()` as a procedure's validator,
  instead of validating manually inside the handler
- Set up a typed client that imports only the server's router *type* and
  calls procedures with full inference — no manually written request/
  response interfaces
- Explain, concretely, what breaks at compile time with tRPC that would
  only break at runtime with a plain REST + `fetch` client

## The challenge

Port the todo API from Days 1-2 to tRPC. Build a router with at least:

- `health.check` — a query, no input, returns `{ status: "ok" }`
- `todos.list` — a query, no input, returns the in-memory todo list
- `todos.create` — a mutation, input validated by (a version of) Day 2's
  `reqBody` schema — `title` plus `priority` — appends a todo and returns
  the created item

Then build a small client that actually calls all three procedures —
a script is enough, it doesn't need a UI. The point of the exercise is in
the client: it should import the server's `AppRouter` type and call
procedures through `@trpc/client`, with no hand-written types for
requests or responses anywhere in the client code.

To make the type-safety win concrete, deliberately try calling
`todos.create` with a wrong-shaped input (e.g. a missing `title`, or
`priority` misspelled) and capture what happens — this should be a
*compile-time* error in the client, not something you discover by running
it. Note the exact TypeScript error in `solution.md`.

### Requirements

- The Zod schema used for `todos.create`'s input is the same schema (or a
  trivial variant of it) from Day 2 — don't write a second, parallel
  validator
- The client never manually declares a request or response shape; every
  type comes from `typeof appRouter` via `inferRouterInputs`/
  `inferRouterOutputs` or equivalent
- At least one query and one mutation are actually called end-to-end
  (server running, client hitting it over HTTP) — not just type-checked
  in isolation
- Capture the wrong-shaped-input compile error mentioned above and include
  it in `solution.md`

### Constraints

- No OpenAPI/Swagger code generation, no GraphQL codegen — the whole
  point of tRPC is inferring types without a generation step
- Bun or Node for the server, whichever adapter is more natural for your
  setup (standalone HTTP adapter, or Bun's native fetch handler)

## Bonus round (optional)

- Add a small middleware — e.g. logging each procedure call with its
  timing, a callback to Day 1's performance theme
- Try the `superjson` transformer and pass something `JSON.stringify`
  can't handle natively (a `Date`) through a procedure untouched
- Write down, in `solution.md`, one concrete tradeoff of tRPC's
  "TypeScript-only contract" approach vs. a REST + OpenAPI setup (e.g. a
  non-TypeScript client can't consume the inferred types the same way)

## Resources

- https://trpc.io/docs/quickstart
- https://trpc.io/docs/server/routers
- https://trpc.io/docs/server/validators (Zod integration)
- https://trpc.io/docs/client/vanilla

---

Once you've built something, write up `solution.md` in this folder using
`../_template/solution.md` as a starting point.
