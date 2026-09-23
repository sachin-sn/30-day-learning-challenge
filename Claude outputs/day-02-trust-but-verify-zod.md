---
title: "Day 2 — Trust, But Verify: Runtime Validation with Zod"
date: "2026-09-23"
excerpt: "TypeScript's types disappear the moment your code runs. Day 2 replaces a type assertion with real runtime validation using Zod — and racks up six more self-inflicted bugs finding out why that matters."
tags: ["30-day-challenge", "day-02", "zod", "typescript", "bun", "api-design", "security"]
draft: true
---

## Why this one matters

Day 1 shipped a todo API with one line I glossed over at the time:

```ts
const body = (await req.json()) as reqBody;
```

That `as` is a promise you make to the compiler, not a check. TypeScript
believes you, happily autocompletes `body.title`, and is fully satisfied —
right up until a real caller sends `{ "ttitle": "typo" }` and your code
finds out the hard way, at 2am, in production. TypeScript's type system
ends at compile time. It has no idea what's actually inside the `Request`
that hits your server at runtime.

Day 2 replaces that assertion with [Zod](https://zod.dev) — a schema
library that gives you both a compile-time type and a real runtime check
from the same definition, so there's exactly one source of truth instead
of a type and a validator that can silently drift apart.

## The challenge

Two parts, both about closing the same gap in different places:

**Part 1 — validate the request body.** Replace the `as reqBody` assertion
with a real Zod schema, and extend the todo shape with a `priority` field
so the validation is actually doing something.

**Part 2 — validate config at startup.** Add a `PORT` environment variable
and validate it with Zod *before* the server starts listening — fail fast
with a clear message if it's missing or not a valid port number, instead
of finding out from a cryptic error three requests in.

## The code

```ts
import * as z from "zod";

const reqBody = z.object({
  title: z.string(),
  priority: z.literal(["low", "medium", "high"]).default("medium"),
});

const todoType = reqBody.extend({ id: z.int() });

const envType = z.object({
  PORT: z.coerce.number().int().min(1).max(65535),
});

const todos: z.infer<typeof todoType>[] = [];

const env = envType.safeParse(process.env);
if (env.success) {
  const server = Bun.serve({
    port: env.data.PORT,
    routes: {
      "/health": () => Response.json({ status: "ok" }),
      "/todos": {
        GET: () => Response.json({ todos }),
        POST: async (req) => {
          const body = reqBody.safeParse(await req.json());
          if (!body.success) {
            return Response.json({ errors: body.error.issues }, 400);
          }
          const { title, priority } = body.data;
          const id = todos.length;
          const todo = { id, title, priority };
          todos.push(todo);
          return Response.json(todo);
        },
      },
    },
  });
  console.log(`Bun server is running at ${server.url}`);
} else {
  console.log("ERROR!!! properties missing in PORT config", env.error.issues);
}
```

Two things worth noticing even before the bugs: `todoType` isn't declared
separately from `reqBody` — it's `reqBody.extend({ id: z.int() })`, so the
stored-todo shape can never quietly drift out of sync with the input
shape. And `Bun.serve()` only gets called inside `if (env.success)` — an
invalid `PORT` never gets anywhere near `.listen()`.

## Six bugs, two categories

Day 1 was three crashes in the Node server. Day 2 turned out to be six —
split evenly between the request body and the config check — and none of
them were Zod being unclear. They were assumptions a type checker has no
way to catch.

**Request body:**

1. `z.object({ title: z.string })` — missing parens on `z.string`. Not a
   schema, just a reference to the function itself. Threw immediately:
   *"Invalid element at key 'title': expected a Zod schema."*
2. `await reqBody.parse(req.json())` — `await` on the wrong side of the
   parens. This parses the **unresolved Promise** `req.json()` returns,
   not the resolved body, so every request failed with a confusing
   `expected string, received undefined` even when the body was fine.
3. `const todos: any = []` — `todoType` existed but nothing actually wired
   it to the array.
4. One path still used `.parse()` instead of `.safeParse()` and threw an
   uncaught `ZodError` on a genuinely bad request — the same failure mode
   as Day 1's `JSON.parse` crash, one layer further up the stack.
5. Switching to `safeParse()` surfaced `Property 'title' does not exist on
   type 'ZodSafeParseResult'` — `safeParse` returns a **discriminated
   union**, `{ success: true, data } | { success: false, error }`, and
   TypeScript won't let you touch `.data` until you've narrowed on
   `.success` first. Not a bug — the compiler doing exactly its job.
6. Once everything else worked, `priority` was validated and then
   silently thrown away — accepted, never stored, never returned.

**Config validation:**

7. The env schema's key was `port` (lowercase), checked against
   `process.env`, where the real convention — Heroku, Render, Docker,
   basically anything that injects a port — is uppercase `PORT`. Env var
   lookups are case-sensitive, so this schema **always** failed against a
   real `PORT`, and silently "worked" only once `.env` was changed to a
   non-standard `port=3000` to match it. That's relocating the bug, not
   fixing it.
8. Even after the key was fixed, the schema was just `z.string()` — which
   validates that something *is* a string, not that it's a *useful* one.
   `"notanumber"` and `"999999"` both passed. `z.coerce.number().int()
   .min(1).max(65535)` is what actually enforces "valid port number."

## The part that isn't in the code: what's safe to say back

Once the 400 responses were structured (`{ errors: body.error.issues }`),
a sharper question showed up: *is it safe to just echo Zod's error object
back to the client, always?*

Usually yes — "title is required" is genuinely useful and not sensitive.
But the same instinct applied carelessly to a field like a `role` enum
would return the entire list of accepted role values to anyone who sends
a bad request, effectively handing over your permission model's internal
detail. This is the same shape as the classic
username-enumeration-via-login-error mistake, and it maps directly onto
[OWASP API Security's Broken Object Property Level
Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
and the newer OWASP Top 10:2025's *Mishandling of Exceptional
Conditions* category — both are, at their core, about what an error
response is allowed to reveal. The fix isn't "never return validation
errors," it's deciding, per field, whether the accepted values are public
contract (`priority: low | medium | high` — completely fine to expose) or
internal detail that deserves a generic message instead.

## Zod, pros and cons, honestly

TypeScript vs. Zod isn't really a contest — it's a trust-boundary
question. Data that never leaves code you control (internal function
calls, values you already validated once) doesn't need Zod on top of
TypeScript. Data that crosses in from outside — an HTTP body, `process
.env`, a third-party API response, a file upload — needs a runtime check,
because TypeScript can't see it. `reqBody` and `envType` are both boundary
checks; nothing else in this file needed a schema.

**What's genuinely good about Zod v4:** it's fast now — roughly 14.7x
faster string parsing, 6.5x faster object parsing than v3 — and small,
with the core bundle down to 5.36kb and the tree-shakable `zod/mini` API
at 1.88kb. It also got noticeably kinder to the TypeScript compiler: a
schema built with `.extend()` — the exact pattern `todoType` uses — went
from over 25,000 type instantiations in v3 to about 175 in v4.
`z.infer<>` and `safeParse`'s discriminated union are still the strongest
ergonomic argument for it over hand-rolled checks.

**What's still a real cost:** Zod is architecturally an interpreter — it
walks the schema graph and re-executes validation logic on every call,
rather than compiling to an optimized function ahead of time the way
ArkType or Typia do. One benchmark put a compiled validator at ~76M
ops/sec against Zod v4's ~6.7M. For a todo API that's irrelevant — I/O
dominates — but it's a real number for a high-throughput API gateway.
The v4 TypeScript wins aren't absolute either: some teams have hit `TS2589
Type instantiation is excessively deep and possibly infinite` in v4
specifically, with deeply nested discriminated unions. And v3→v4 wasn't a
free migration for large codebases — stricter `.pipe()` typing and
`.superRefine()` being replaced by the lower-level `.check()` both drew
real complaints from teams upgrading ~100k-line apps.

None of that is unique to Zod — it's the standard trade every schema
library makes, safety and DX against raw parse speed and API stability —
but it's worth stating plainly rather than treating v4 as having solved
everything.

## What's next

Day 3 moves to type-safe APIs with tRPC — building the client/server
contract Zod's schemas already gave us a head start on. Full write-up,
code, and the bug list for today are in the
[repo](#) — `day-02-runtime-validation-zod/`.
