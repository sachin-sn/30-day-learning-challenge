# Day 2 — Runtime Validation with Zod

**Difficulty:** Beginner
**Tech stack:** TypeScript, Zod
**Estimated time:** 1-2 hours

## Why this matters

TypeScript's types disappear at runtime — they're a compile-time contract,
not a guarantee. Anything crossing a real boundary (an HTTP request body, an
environment variable, a third-party API response) can violate your types
without TypeScript ever knowing, because an `as` assertion is a promise you
make to the compiler, not a check. Day 1's `(await req.json()) as reqBody`
on both the Bun and Node servers is exactly this: if a caller sends
`{ "ttitle": "typo" }` instead of `{ "title": "..." }`, TypeScript is
already satisfied and your code finds out the hard way. Zod (and libraries
like it — Valibot, ArkType) closes that gap: one schema gives you both the
compile-time type and a real runtime check.

## Learning objectives

By the end of today you should be able to:

- Replace an `as` type assertion with a real runtime-validated boundary
- Derive a TypeScript type from a schema with `z.infer<>` instead of
  hand-maintaining an interface and a validator separately
- Return structured, useful validation errors instead of a generic crash
- Validate `process.env` at startup so misconfiguration fails immediately
  and loudly, not three requests into production

## The challenge

**Part 1 — validate the request body.** Take your Day 1 todo API (Bun,
Node, or both) and replace the `as reqBody` type assertion with a real Zod
schema. Extend the todo shape with at least one field beyond `title` so the
validation is actually doing something — e.g. `priority: "low" | "medium" |
"high"` (optional, defaults to `"medium"`) or `dueDate` (optional ISO date
string, validated as a real date, not just any string).

**Part 2 — validate config at startup.** Add a `PORT` environment variable
(with a sane default) and validate it with Zod before the server starts
listening — fail fast with a clear message if it's missing or not a valid
port number, instead of finding out later from a cryptic `.listen()` error.

### Requirements

- One Zod schema is the single source of truth for both the TypeScript type
  and the runtime check — no separately hand-maintained `interface` sitting
  next to a validator that could drift out of sync with it
- Invalid `POST` bodies return `400` with a structured list of what
  specifically failed, not just a generic "bad request"
- Use `safeParse`, not `parse`, at the API boundary — a bad request should
  produce a handled 400, not an unhandled exception (Day 1's `JSON.parse`
  crash is exactly the failure mode to avoid repeating here)
- Startup config validation runs and can fail *before* the server starts
  listening

### Constraints

- Zod itself only — no framework-level validation middleware
  (zod-express-middleware, tRPC, etc.). The point is understanding what Zod
  is actually doing, not wiring up a library that does it for you.

## Bonus round (optional)

- Use `.refine()` to add a custom cross-field rule — e.g. `dueDate` must not
  be in the past
- Compare Zod's parse overhead against an equivalent hand-written validation
  function for the same schema, and note the numbers in `solution.md` — a
  nice callback to Day 1's performance theme
- Try the same schema in one alternative (Valibot or ArkType) and note the
  API/DX differences

## Resources

- https://zod.dev/
- https://zod.dev/api (safeParse vs parse)
- https://zod.dev/error-customization

---

Once you've built something, write up `solution.md` in this folder using
`../_template/solution.md` as a starting point.
