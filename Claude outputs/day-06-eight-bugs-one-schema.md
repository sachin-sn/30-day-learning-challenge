---
title: "Day 6 — Eight Bugs, One Schema"
date: "2026-09-28"
excerpt: "GraphQL Yoga on Bun. The schema looked right at every single step — it just kept being wrong in a new place each time I actually ran it."
tags: ["30-day-challenge", "day-06", "graphql", "graphql-yoga", "zod", "bun"]
draft: true
---

Day 3's tRPC lesson was "it read fine, it didn't run." Today's GraphQL
exercise made the same point eight separate times, in eight different
places, because fixing one thing kept exposing the next.

## The schema wasn't even valid GraphQL

First mistake: writing `type Priority = "LOW" | "MEDIUM" | "HIGH";` in the
schema string — that's TypeScript syntax. GraphQL enums look like this:

```graphql
enum Priority {
  LOW
  MEDIUM
  HIGH
}
```

`createSchema()` throws a syntax error immediately if you get this wrong,
which is at least an honest failure. The next ones weren't.

## A resolver isn't a request handler

```ts
createTodo: async (req) => {
  const body = (await req.json()) as reqBody;
  // ...
}
```

A resolver's first argument is `parent`, not an HTTP `Request` — GraphQL
already parsed the query and put the real arguments in the *second*
parameter (`args`) before your resolver runs. `req` here is `undefined`
for a root mutation, so this throws `Cannot read properties of undefined
(reading 'json')` on every single call. The fix removes code, not adds
it — GraphQL already did the parsing:

```ts
createTodo: (_parent, args) => insertToTodo(args.title, args.priority)
```

## A one-letter typo that crashes the whole server

`resolvers: { query: { ... } }` instead of `Query` looks like nothing.
It's actually fatal: resolver keys are matched against schema type names
case-sensitively, and the mismatch throws at server startup —
`"query" defined in resolvers, but not in schema"` — not a per-request
error, a crash before anything can serve traffic.

## The subtlest one: validation that broke everything it was supposed to protect

Reused Day 2's Zod schema for `createTodo`'s input, which checked
`priority` against `["low", "medium", "high"]` — lowercase, because
that's how the REST version took it. GraphQL enums, though, always
resolve to their uppercase name at runtime: `"MEDIUM"`, never `"medium"`.
Every legitimate call — including ones with a perfectly good title —
failed validation, because the case never matched. The error message was
also hardcoded to `"Missing title"`, which pointed at the wrong field
entirely. Nastiest kind of bug: it doesn't look broken from the outside,
it just rejects everything, including the things that should work.

## Errors that lie by default

Fixing the validation exposed one more thing: on failure, the code
returned `{ error: message }` instead of throwing. GraphQL tried to read
`.id` off that object for the `Todo!` response, found nothing, and threw
its own internal error — which `graphql-yoga` then masked into a generic
`"Unexpected error."` at the client by default. The real message only
showed up in the server's own terminal. Throwing a `GraphQLError`
specifically (not a plain `Error`) bypasses that masking, so the actual
"title is empty" message reaches whoever's calling the API instead of a
black box.

## What finally worked

Two validation layers, doing different jobs: GraphQL's type system
catches shape (a missing or wrong-type argument, rejected before any
resolver runs), Zod catches business rules GraphQL can't express — like
`"   "` not counting as a real title once `.trim()` runs before `.min(1)`.

## What's next

Day 7: Kafka fundamentals. Full code in the
[repo](#) — `day-06-graphql-basics/`.
