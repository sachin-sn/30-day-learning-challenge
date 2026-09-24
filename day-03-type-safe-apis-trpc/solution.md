# Day 3 — Solution: Type-safe APIs with tRPC

**Blog post:** <link, once published>
**LinkedIn post:** <link, once shared>

## Approach

Ported the Days 1-2 todo API to a tRPC router — `health.check`, `todos.list`,
`todos.create` — reusing Day 2's `reqBody` Zod schema directly as
`todos.create`'s input validator rather than writing a second one. The
router is mounted alongside the existing plain REST routes in `index.ts`
via `fetchRequestHandler` at `/trpc/*`, and both the REST handlers and the
tRPC procedures now read and write the same in-memory `todos` array
(moved into `trpc.ts` so it's shared instead of duplicated).

The router itself was defined correctly-looking on the first pass, but
none of it actually did anything yet — it wasn't wired to the server, one
resolver was reading the wrong object, and the input schema wasn't quite
what it looked like. All three were confirmed as real bugs by actually
executing the router against the real `@trpc/server`/`zod` packages via
`appRouter.createCaller()`, not just by reading the code — Bun itself
still isn't runnable in the environment doing the review, so this was the
next best thing to actually starting the server.

## Key concepts learned

- A tRPC procedure's resolver receives a single `opts` object —
  `{ input, ctx, path, ... }` — not the validated input directly. Naming
  the resolver's parameter `input` doesn't make it the input; you still
  need `opts.input`. Confirmed by actually calling a resolver that got
  this wrong: it re-validated the *entire `opts` object* against the input
  schema and failed no matter what shape was sent in, because `opts` never
  has a `title` key at the top level.
- `.input(mySchema)` reuses a schema directly; `.input(z.object({
  mySchema }))` wraps it in a new object under a key named after the
  variable, which is a different, unintended contract — the required
  shape becomes `{ mySchema: {...} }` instead of `{...}` itself. Easy
  mistake to make when you're passing a schema variable into `z.object()`
  out of habit.
- tRPC's whole pitch is "no code generation" — the client imports the
  server's router *type* (`import type { AppRouter }`) and gets full
  inference, without a generated SDK or a shared runtime import. That only
  works if the client only ever imports `type { AppRouter }`, never a
  runtime value from the server file.
- A schema field with `.default()` (like `priority` here) is *optional* on
  the caller-facing input type, even though `z.infer<>`'s output type has
  it required — the default only fills in after parsing, so the type a
  client is allowed to send has to make it optional.
- Bun's `routes` object supports wildcard path keys like `"/trpc/*"`,
  handled by a plain function that receives the raw `Request` — that's
  what makes mounting `fetchRequestHandler` alongside existing REST routes
  a one-line addition rather than a separate server.

## Code walkthrough

- `src/bun/trpc.ts` — `reqBody`/`todoType`/`envType` (from Day 2), the
  shared `todos` array, and `appRouter` with `health.check` (query),
  `todos.list` (query), `todos.create` (mutation, input = `reqBody`
  directly).
- `src/bun/index.ts` — validates `PORT` exactly as in Day 2, then serves
  `/health` and `/todos` as before *and* mounts `appRouter` at `/trpc/*`
  via `fetchRequestHandler`, all sharing one `todos` array.
- `src/bun/client.ts` — a vanilla `@trpc/client` client built with
  `createTRPCClient<AppRouter>` + `httpBatchLink`, importing only
  `type { AppRouter }`. Calls all three procedures end-to-end, plus a
  commented-out deliberately-wrong call (`{ ttitle: "typo" }`) meant to be
  uncommented and checked in the editor — see Gotchas.

## Gotchas / things that tripped me up

1. The router was fully defined but never imported into `index.ts` —
   the server was still only serving Day 2's plain REST routes. A
   correct-looking router that nothing ever calls is indistinguishable
   from a broken one until you actually try to hit it.
2. `todos.create`'s resolver read `reqBody.parse(input)` where `input`
   was actually the whole `opts` object, not the parsed body. Proved this
   two ways by actually calling it: sending the shape the `.input()`
   schema demanded still failed (because `opts` has no top-level `title`),
   and sending the shape a caller would naturally expect failed for a
   *different* reason — see next point. Fixed by destructuring
   `opts.input` instead.
3. `.input(z.object({ reqBody }))` nested the schema under a `reqBody`
   key instead of reusing it, so the real required shape was
   `{ reqBody: { title, priority } }`. Fixed to `.input(reqBody)`.
4. `todos.list` and `todos.create` didn't share state with the rest of
   the app — `list` hardcoded `{ todos: [] }` and `create` fabricated a
   `{ id: 1, ... }` without storing it anywhere. Fixed by moving the
   `todos` array into `trpc.ts` so both the router and the REST handlers
   in `index.ts` reference the same one.

## What I'd do differently

- **Open item:** run `bun run index.ts` and `bun run client.ts`, then
  uncomment the deliberately-bad call in `client.ts`
  (`client.todos.create.mutate({ ttitle: "typo" })`) and paste the exact
  TypeScript error here. Expected, based on the schema (`priority` is
  optional on the input side because of its `.default()`), something like
  *"Object literal may only specify known properties, and 'ttitle' does
  not exist in type '{ title: string; priority?: "low" | "medium" |
  "high" | undefined }'."* — but that's a prediction from reading the
  types, not something actually observed by running `tsc`, since the
  native TS7 compiler couldn't be run for verification. Confirming this
  for real is the one piece that would make today's write-up complete.
- Add the bonus round: a small logging middleware (timing each procedure
  call, callback to Day 1), and the `superjson` transformer to pass a
  `Date` through untouched.
- Write down the one honest tradeoff the bonus round asks for: a
  non-TypeScript client (or a TypeScript client that doesn't share a
  monorepo with the server) gets none of this inference for free — tRPC's
  type safety is a same-codebase, same-language contract, not a
  network-level one like an OpenAPI schema would be.

## Further reading

- https://trpc.io/docs/server/procedures
- https://trpc.io/docs/server/adapters/fetch
- https://trpc.io/docs/client/vanilla/setup
- https://bun.com/docs/api/http
