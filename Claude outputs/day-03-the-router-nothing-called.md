---
title: "Day 3 — The Router Nothing Called"
date: "2026-09-24"
excerpt: "Ported Day 2's todo API to tRPC. The router looked correct, called cleanly in isolation, and did nothing — until I actually ran it against real code."
tags: ["30-day-challenge", "day-03", "trpc", "typescript", "zod", "bun"]
draft: true
---

Day 2 fixed the server's side of trust: bad request bodies get a
structured 400 instead of a crash. The client calling it was still
guessing — a plain `fetch()` has no idea what shape the server wants until
the request is already on the wire. [tRPC](https://trpc.io) closes that:
the client imports the server's router *type*, not its code, and gets
full compile-time checking on every call — no code generation step.

```ts
export const appRouter = t.router({
  todos: {
    create: publicProcedure
      .input(reqBody)        // Day 2's Zod schema, reused directly
      .output(todoType)
      .mutation((opts) => {
        const { title, priority } = opts.input;
        const todo = { id: todos.length, title, priority };
        todos.push(todo);
        return todo;
      }),
  },
});
```

## Three bugs, one theme: it read fine, it didn't run

The first version of this router looked done. It wasn't wired to anything.

**The server never mounted it.** `index.ts` still only served Day 2's
plain REST routes — the tRPC router was a fully-formed object nothing
ever imported. Fixed with one route in Bun's `routes` object:

```ts
"/trpc/*": (req) =>
  fetchRequestHandler({ endpoint: "/trpc", req, router: appRouter, createContext: () => ({}) }),
```

**The resolver read the wrong object.** tRPC's `.mutation()` callback
receives one `opts` argument — `{ input, ctx, ... }` — not the input
itself. The code did `reqBody.parse(input)`, naming that whole `opts`
object `input` and re-validating it as if it were the body. I proved this
by actually calling the router two different ways rather than just
reading it: sending the shape the schema demanded still failed (no
`title` at the top of `opts`), and sending the shape a caller would
naturally expect failed for an unrelated second reason.

**That second reason:** `.input(z.object({ reqBody }))` nested the schema
under a `reqBody` key instead of reusing it — so the actual required
shape was `{ reqBody: { title, priority } }`, not `{ title, priority }`.
`.input(reqBody)` is what "reuse the schema directly" actually means.

None of these threw a type error. `z.object({ reqBody })` and
`reqBody.parse(input)` are both completely valid TypeScript — they're
just not what was intended. The compiler checks that your code is
internally consistent, not that it does the thing in your head.

## The point of today, still pending

The actual payoff — a wrong-shaped client call failing in the editor
instead of at runtime — needs an editor or `tsc` to see it, and I don't
have Bun available where I ran today's verification. The client's ready:

```ts
// await client.todos.create.mutate({ ttitle: "typo" });
```

Uncommenting that should be a compile error, not a network round trip.
I'll confirm the exact message once I run it — worth being honest that
the router logic is proven (I ran it directly against the real `zod`/
`@trpc/server` packages: health check, list, two creates with correctly
incrementing ids, and a rejected bad input), but this one piece is a
prediction from reading the types, not yet an observed result.

## What's next

Day 4: Redis caching patterns. Full code for today's in the
[repo](#) — `day-03-type-safe-apis-trpc/`.
