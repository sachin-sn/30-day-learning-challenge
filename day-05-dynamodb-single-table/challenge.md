# Day 5 — DynamoDB Single-Table Design

**Difficulty:** Intermediate
**Tech stack:** AWS DynamoDB (via DynamoDB Local + Docker), AWS SDK v3
**Estimated time:** 2-3 hours

## Why this matters

Every day so far has kept todos in memory — gone the moment the process
restarts. DynamoDB is the natural next step, but using it well means
unlearning the relational instinct of "one table per entity type." DynamoDB
bills and scales around access patterns, not entities: the standard advice
is one table, multiple entity types, and a generic partition key (`PK`) /
sort key (`SK`) pair whose *meaning* changes per item. Get the key design
wrong and every query becomes an expensive table scan; get it right and
almost everything is a single, cheap, indexed lookup. This is also a
recurring interview topic on its own, independent of whether you ever touch
DynamoDB day to day.

Docker's already working on your machine after yesterday — DynamoDB Local
runs in a container, so today doesn't need an AWS account or any real
spend.

## Learning objectives

By the end of today you should be able to:

- Design a single-table schema for two related entity types using a
  generic `PK`/`SK` pair, and explain what each key actually encodes
- Write access patterns *before* writing code, and check each one against
  the schema before implementing it
- Use the AWS SDK v3 (`@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb`)
  to do typed puts, gets, and queries against DynamoDB Local
- Add a Global Secondary Index (GSI) to satisfy an access pattern the base
  table's keys can't serve, and explain why the base table alone can't

## The challenge

Model **users** and **todos** in a single DynamoDB table, running locally
via Docker. Port the todo API's persistence from in-memory to DynamoDB —
no need to keep tRPC or Redis in the loop, plain functions or REST routes
calling DynamoDB directly are fine.

**Part 1 — Get DynamoDB Local running.** `docker-compose up` with the
official `amazon/dynamodb-local` image, port 8000, `-sharedDb` so every
client that omits explicit AWS credentials sees the same data. Confirm it's
up by creating a table with the AWS CLI or SDK before writing app code.

**Part 2 — Design the schema, on paper, before coding.** One table. Two
entity types:

- A user: `PK = USER#<userId>`, `SK = USER#<userId>`
- A todo belonging to that user: `PK = USER#<userId>`, `SK =
  TODO#<todoId>`

Write down, in `solution.md`, every access pattern you need *before*
implementing it (e.g. "get a user by id," "list all todos for a user,"
"get one todo by id") and which key(s) each one hits. This is the step
people skip and then can't explain their own table.

**Part 3 — Implement it.** CRUD for both entities using the AWS SDK v3
document client (`DynamoDBDocumentClient`, `PutCommand`, `GetCommand`,
`QueryCommand`). Listing a user's todos should be a `Query` on `PK =
USER#<userId>` with a `SK` prefix condition — not a `Scan`.

**Part 4 — Add one GSI.** Pick an access pattern the base table's keys
can't serve — e.g. "list all todos with status `pending` across every
user" — and add a GSI with a different partition key (e.g. `GSI1PK =
STATUS#<status>`) to serve it. Run the query for real and show it only
returns matching items, not a filtered scan.

### Requirements

- Two distinct entity types live in the same table, distinguished by `SK`
  prefix, not by two separate tables
- At least one query uses a `SK` `begins_with`/prefix condition, not an
  exact match
- The GSI access pattern from Part 4 is demonstrated with a real `Query`
  against the index, and `solution.md` explains why the base table's keys
  alone couldn't serve it
- No `Scan` calls in the final code — if you reach for one, that's a sign
  an access pattern didn't get a key design

### Constraints

- DynamoDB Local only — no real AWS account, no real cost
- AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`), not v2
  and not a third-party ORM

## Bonus round (optional)

- Add a TTL attribute to completed todos (DynamoDB's own native TTL, not
  Redis's) and explain in `solution.md` how it differs from yesterday's
  Redis TTL — in particular, that DynamoDB's TTL deletion isn't immediate
- Use `TransactWriteCommand` for an operation that must touch two items
  atomically (e.g. marking a todo done *and* incrementing a
  `completedCount` attribute on the user item) and show what happens if
  you simulate one half failing
- Use `BatchWriteCommand` to seed a handful of todos in one call instead of
  N separate `Put`s

## Resources

- https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html
- https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.DownloadingAndRunning.html
- https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html
- https://github.com/aws/aws-sdk-js-v3/blob/main/lib/lib-dynamodb/README.md

---

Once you've built something, write up `solution.md` in this folder using
`../_template/solution.md` as a starting point.
