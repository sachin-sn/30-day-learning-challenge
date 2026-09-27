# Day 6 — GraphQL Basics

**Difficulty:** Beginner-Intermediate
**Tech stack:** GraphQL, GraphQL Yoga (or Apollo Server), TypeScript, Bun
**Estimated time:** 1.5-2.5 hours

## Why this matters

Day 3's tRPC closed the client/server type gap, but only within one
codebase — the client had to be TypeScript and had to import the
server's types directly. GraphQL solves a related but different problem:
a client in *any* language gets a fully typed contract via introspection,
and — its original selling point — asks for exactly the fields it needs,
nothing more. A REST `/todos` endpoint returns whatever shape the server
decided on; a GraphQL client asking for `{ todos { title } }` gets back
*only* `title`, even if the underlying data has ten other fields. That's
worth seeing for real, not just reading about, since it's usually the
first thing anyone says about GraphQL without ever having watched it
happen.

## Learning objectives

By the end of today you should be able to:

- Write a GraphQL schema (SDL) with a `Query` type and a `Mutation` type
- Write resolvers that read from and write to shared application state
- Run a real query and a real mutation against a running GraphQL server
  — not just click around in the GraphiQL playground
- Point at one concrete request/response pair from today and explain what
  a REST equivalent would have sent back instead

## The challenge

Expose the todo API as a GraphQL API, reusing the same in-memory `todos`
state this series has carried since Day 1.

Build a schema with at least:

```graphql
enum Priority { LOW MEDIUM HIGH }

type Todo {
  id: Int!
  title: String!
  priority: Priority!
}

type Query {
  todos: [Todo!]!
  todo(id: Int!): Todo
}

type Mutation {
  createTodo(title: String!, priority: Priority): Todo!
}
```

Mount it with `graphql-yoga`'s `createYoga()`, passed as Bun's `fetch`
handler (or as one entry in Bun's `routes` object at `/graphql`, your
choice) — Yoga ships a GraphiQL playground for free at that endpoint, but
the playground is for your own poking around, not for the proof you put
in `solution.md`.

Reuse Day 2's Zod schema (or a trivial variant) to validate
`createTodo`'s input inside the resolver before writing to state.
GraphQL's type system enforces *shape* (a `String!` really is a string),
but not business rules like "title can't be empty" — that's still your
job, same as it was in Day 2.

### Requirements

- A real query and a real mutation, each actually sent to the running
  server (`curl`, a small script, or a GraphQL client — not just
  GraphiQL) and the real request/response captured in `solution.md`
- One request that deliberately asks for a subset of `Todo`'s fields
  (e.g. just `title`), with the real response showing only that field
  came back — this is the over/under-fetching point, made concrete
  instead of asserted
- One deliberately invalid mutation call (wrong type, or a field that
  doesn't exist on the schema) with the real GraphQL error response
  captured — GraphQL returns a structured `errors` array in a 200
  response for this, not an HTTP error code; note that difference,
  it trips people up
- `createTodo` actually validates with the reused Zod schema, not just
  the GraphQL type system

### Constraints

- `graphql-yoga` is the natural fit (Bun-fetch friendly, same pattern as
  Day 3's `fetchRequestHandler`), but Apollo Server is fine if you'd
  rather compare the two
- Coexisting with Day 3's tRPC route or Day 1-2's REST routes on the same
  server is fine but not required — today's proof is the GraphQL side

## Bonus round (optional)

- Add a computed field that isn't stored directly, e.g. a `todoStats`
  query returning `{ pending: Int!, done: Int! }` derived from the todos
  array in the resolver — good practice for resolvers that aren't a
  straight field passthrough
- Write down, in `solution.md`, one concrete tradeoff of GraphQL vs Day
  3's tRPC — e.g. GraphQL's introspection gives any language a typed
  client at the cost of a schema you maintain by hand, where tRPC's
  types are free but TypeScript-only
- If you're feeling ambitious: add a `user` field on `Todo` (tying back
  to Day 5's DynamoDB user model) and notice what happens to the number
  of resolver calls when you query `todos { user { userName } }` for a
  list of todos — that's the classic GraphQL N+1 problem. You don't need
  to solve it (that's what DataLoader is for) — just observe it and
  explain what's happening

## Resources

- https://graphql.org/learn/
- https://the-guild.dev/graphql/yoga-server
- https://the-guild.dev/graphql/yoga-server/docs/integrations/integration-with-bun
- https://www.apollographql.com/docs/apollo-server

---

Once you've built something, write up `solution.md` in this folder using
`../_template/solution.md` as a starting point.
