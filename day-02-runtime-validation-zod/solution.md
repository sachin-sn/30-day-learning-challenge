# Day 2 — Solution: Runtime Validation with Zod

**Blog post:** <link, once published>
**LinkedIn post:** <link, once shared>

## Approach

Took Day 1's Bun todo API and replaced the `(await req.json()) as reqBody`
type assertion with real Zod schemas in two places: the `POST /todos`
request body, and a new `PORT` environment variable checked at startup
before the server binds.

For the request body, `reqBody` stays the single source of truth — `title`
plus a `priority` enum that defaults to `"medium"` — and `todoType` is
derived from it with `.extend({ id: z.int() })` instead of being declared
separately, so the stored-todo shape can't drift out of sync with the
input shape. For config, a second schema validates `process.env` itself
and the server only calls `Bun.serve()` inside the `if (env.success)`
branch — an invalid or missing `PORT` never gets anywhere near
`.listen()`.

Both schemas went through a few real rounds of bugs before they actually
did what they looked like they did — see Gotchas. Most of them weren't
Zod being unclear; they were assumptions (about `await` placement, about
env var casing, about what `z.string()` guarantees) that a type checker
has no way to catch.

## Key concepts learned

- `safeParse` returns a discriminated union —
  `{ success: true, data } | { success: false, error }` — so TypeScript
  won't let you read `.data` or `.error` until you've narrowed on
  `.success` first. That's a feature, not friction: it's the compiler
  forcing the same check you'd want to do by hand anyway.
- `z.infer<typeof schema>` makes the schema the single source of truth for
  both the compile-time type and the runtime check. `ZodObject.extend()`
  builds on that — `todoType` is `reqBody` plus `id`, not a second
  hand-maintained shape that has to be kept in sync manually.
- A validation error message is a public API response, not a debug log.
  `body.error.issues` is safe to return as-is for something like a missing
  `title`, but the same instinct applied carelessly to an enum field can
  leak implementation detail — e.g. an error that echoes back the full set
  of accepted `role` values on a permissions field tells an attacker
  exactly what's worth trying. The fix isn't "never expose validation
  errors," it's deciding per field whether the accepted values are public
  contract (`priority: low/medium/high` — fine) or internal detail worth
  a generic message instead.
- Env vars are case-sensitive, and there's no runtime magic that connects
  `process.env.PORT` to a schema key spelled `port`. A schema that
  "validates config" but checks the wrong key doesn't fail loudly — it
  just always takes the failure branch, which looks identical to "PORT is
  never being set" until you actually test it against the real
  convention.
- `z.string()` validates that something is *a* string, not that it's a
  *useful* one. Checking that `PORT` is present isn't the same as checking
  it's a valid port number — `z.coerce.number().int().min(1).max(65535)`
  is what actually rejects `"notanumber"` or `"999999"`, not the presence
  check alone.

## Code walkthrough

`src/bun/index.ts`:

- `reqBody` — the request-body schema (`title`, `priority` with a default).
- `todoType = reqBody.extend({ id: z.int() })` — the stored-todo shape,
  derived rather than duplicated.
- `envType` — `{ PORT: z.coerce.number().int().min(1).max(65535) }`,
  checked once at startup via `envType.safeParse(process.env)` before
  `Bun.serve()` is ever called; the `else` branch logs the structured
  issues and the server never starts.
- `POST /todos` — `reqBody.safeParse(await req.json())`, structured
  `{ errors: body.error.issues }` on a `400` for anything invalid, no
  `try/catch` needed since `safeParse` never throws.

## Gotchas / things that tripped me up

**Request body:**

1. `z.object({ title: z.string })` — missing parens on `z.string`, so the
   value passed in wasn't a schema at all. Threw immediately: "Invalid
   element at key 'title': expected a Zod schema."
2. `await reqBody.parse(req.json())` — the `await` was on the wrong side.
   This parsed the *unresolved Promise* that `req.json()` returns, not the
   resolved body, so every request failed validation with a confusing
   `expected string, received undefined` on `title` even when the body
   was fine.
3. `const todos: any = []` — `todoType` existed but nothing wired it to
   the array, so the array itself had no real type at all.
4. After fixing 1–3, one path still used `.parse()` instead of
   `safeParse()` and threw an uncaught `ZodError` on a genuinely invalid
   request — the exact failure mode Day 1's `JSON.parse` crash already
   demonstrated, just one layer up the stack.
5. Switching to `safeParse()` surfaced a TS error —
   `Property 'title' does not exist on type 'ZodSafeParseResult'` — from
   reading `.data` before narrowing on `.success`. Not a bug so much as
   the discriminated-union check doing its job.
6. Once all of that was fixed, `priority` was validated but silently
   dropped — accepted, then never stored or returned, and `todoType`
   didn't even declare the field.

**Config validation:**

7. First version's env schema key was `port` (lowercase), checked against
   `process.env` where the real, standard variable is `PORT`. Since env
   var lookups are case-sensitive, this always failed — including with a
   real `PORT` set the normal way — and only "worked" once `.env` was
   changed to the non-standard lowercase `port=3000` to match the schema,
   which just relocates the bug rather than fixing it.
8. That first version was also just `z.string()` for `PORT` — it accepted
   any string, including `"notanumber"` or an out-of-range `"999999"`,
   which defeats the point of "fail fast if it's not a valid port number."

## What I'd do differently

- Add the `.refine()` bonus — e.g. reject a `dueDate` in the past — to
  show a validation rule that can't be expressed as a plain type.
- Run the Zod-vs-hand-written parse overhead comparison and put real
  numbers next to the claim that Zod's abstraction has a cost; almost
  certainly not the bottleneck next to a network round trip, but worth
  quantifying rather than assuming.
- Try the same two schemas in ArkType for a direct DX comparison — its
  string-based DSL is the most different from Zod's chained-methods style
  of the alternatives, so it'd make the sharpest contrast.
- Decide, and document, an explicit per-field policy for what validation
  detail is safe to return to a client, instead of returning
  `error.issues` wholesale everywhere by default.

## Further reading

- https://zod.dev/api (safeParse vs parse)
- https://zod.dev/error-customization
- https://bun.com/docs/runtime/environment-variables
- https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/
