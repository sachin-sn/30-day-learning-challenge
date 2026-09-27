# Day 06 — Solution: GraphQL Basics

**Blog post:** <link, once published>
**LinkedIn post:** <link, once shared>

## Approach

Exposed the same in-memory todo state this series has carried since Day 1
through a GraphQL API, using `graphql-yoga` mounted at `/graphql` in
Bun's `routes` object, alongside the existing REST routes. Schema has a
`Priority` enum, a `Todo` type, `Query.todos`/`Query.todo(id)`, and
`Mutation.createTodo`. `createTodo` reuses (an adapted version of) Day
2's Zod schema to validate the title beyond what GraphQL's type system
alone can check.

Almost nothing worked on the first pass — not from one bug, but a series
of them, each one only surfacing once the previous one was fixed and the
thing was actually run again. Every fix in this file was confirmed
against the real running server (or, when Bun itself wasn't available for
verification, against the identical `graphql-yoga`/`graphql`/`zod`
package versions run directly) before moving to the next issue.

## Key concepts learned

- A GraphQL resolver's signature is `(parent, args, context, info)` —
  there's no HTTP `Request` object handed to it. GraphQL already parses
  the query and puts the arguments in `args` before your resolver ever
  runs; reaching for `req.json()` inside a resolver is solving a problem
  GraphQL solved for you already.
- Resolver map keys are matched against schema type names *case-sensitively*.
  `resolvers: { query: {...} }` next to `type Query {...}` in the schema
  doesn't just fail to work — it throws at `createSchema()`/`createYoga()`
  time, before the server even starts.
- A resolver returns the plain value matching the GraphQL type, not an
  HTTP `Response`. Wrapping a return value in `Response.json(...)` makes
  GraphQL try to read `.id`/`.title`/etc. off a `Response` object, which
  has none of those, and fails on the first non-nullable field.
- Default argument values belong in the schema (`priority: Priority = MEDIUM`),
  not scattered as a `?? "MEDIUM"` fallback in application code — same
  principle as Day 2's Zod `.default()`. GraphQL fills the default in
  before the resolver runs, so `args.priority` is never `undefined` for a
  client that omits it.
- GraphQL enums resolve to their *string* name at runtime (`"MEDIUM"`),
  not a number — a plain TypeScript `enum Priority { LOW, MEDIUM, HIGH }`
  (numeric) describes a shape that never actually shows up.
- Two independent validation layers exist and fail differently. GraphQL's
  own type system rejects a missing/wrong-type argument *before* any
  resolver runs (`GRAPHQL_VALIDATION_FAILED`, real message reaches the
  client, HTTP 200). Anything past that reaches the resolver, where Zod
  (or similar) enforces business rules GraphQL's type system can't
  express, like "not just whitespace."
- `graphql-yoga` masks server-side errors by default — any plain
  `throw new Error(...)` (or a value shaped wrong for its type, which
  graphql-js turns into an internal error) becomes a generic
  `"Unexpected error."` at the client, with the real message only in the
  server's own logs. Throwing a `GraphQLError` (from the `graphql`
  package) instead bypasses masking and reaches the client — the
  distinction matters if you actually want the caller to see why their
  input was rejected.
- `.min(1)` alone doesn't reject whitespace-only strings — `"   "` has
  length 3. `.trim()` has to run *before* `.min(1)` so the length check
  sees the trimmed string.

## Code walkthrough

`src/bun/index.ts` — schema (`Priority` enum, `Todo`, `Query`,
`Mutation`), `insertToTodo` shared with the REST `/todos` routes, and the
Zod `reqBody` schema (adapted from Day 2: uppercase priority literals to
match GraphQL's enum casing, `title` trimmed before the length check).
`createTodo`'s resolver validates with `reqBody.safeParse`, returns the
plain todo object on success, and throws a `GraphQLError` with Zod's own
message on failure.

## Gotchas / things that tripped me up

This one had more rounds of "looks fixed, run it again" than any day so
far — worth listing in order, since several looked like different bugs
but were really the same category (schema and resolver quietly out of
sync) showing up in a new place each time:

1. `type Priority = "LOW" | "MEDIUM" | "HIGH";` in the schema string is
   TypeScript syntax, not GraphQL SDL — `createSchema()` threw a syntax
   error immediately. Real GraphQL enums use `enum Priority { LOW MEDIUM HIGH }`.
2. No `Query` resolvers were defined at all on the first pass — only
   `Mutation.createTodo` existed. Querying `todos` failed with
   `"Cannot return null for non-nullable field Query.todos."`
3. `createTodo`'s resolver read its first argument as an HTTP `Request`
   (`req.json()`) — but a resolver's first argument is `parent`, which is
   `undefined` for a root mutation field. Threw
   `"Cannot read properties of undefined (reading 'json')"` on every call.
4. Resolver map had `query` (lowercase) instead of `Query` — a silent typo
   that crashes `createYoga()` at startup with
   `Error: "query" defined in resolvers, but not in schema"`, not a
   graceful per-request error.
5. `createTodo` returned `Response.json(todo)` instead of `todo` directly —
   leftover REST-handler habit. GraphQL tried to read fields off the
   `Response` object and failed on `Todo.id`.
6. The reused Zod schema kept lowercase priority literals
   (`["low","medium","high"]`) while GraphQL's enum always produces
   uppercase strings at runtime — this silently broke *every* valid
   `createTodo` call, not just invalid ones, because the case mismatch
   meant nothing could ever match. The error message (a hardcoded
   `"Missing title"`) also pointed at the wrong field entirely.
7. On a validation failure, returning `{ error: parsed.error.message }`
   instead of throwing meant GraphQL tried to serialize that object as a
   `Todo!`, found no `id`, and raised its own internal error — masked by
   Yoga's default error masking into a generic `"Unexpected error."` at
   the client. Fixed by throwing a real `GraphQLError` instead, which
   bypasses masking.
8. `.min(1)` without `.trim()` first let a whitespace-only title
   (`"   "`) through, since length 3 satisfies `>= 1`.

## What I'd do differently

- `insertToTodo`'s own fallback (`priority ?? "medium"`, lowercase) is
  now dead code on the GraphQL path — the schema's default and Zod's
  validation mean `priority` is never actually undefined by the time it
  gets there. It's only reachable from the REST `/todos` POST route, and
  even then the casing wouldn't match `todoType`'s uppercase literal
  check. Worth cleaning up rather than leaving an inconsistency that
  works by accident.
- Didn't get to the bonus round — a computed `todoStats` field, or the
  `user` field/N+1 demonstration tying back to Day 5's DynamoDB model.
- More deliberately-invalid cases would be worth capturing: a
  wrong-*type* argument (e.g. `id: "not-an-int"`) rather than just
  missing/null/business-rule-invalid ones already covered.

## Further reading

- https://graphql.org/learn/
- https://the-guild.dev/graphql/yoga-server
- https://the-guild.dev/graphql/yoga-server/docs/integrations/integration-with-bun
- https://the-guild.dev/graphql/yoga-server/docs/features/error-masking
