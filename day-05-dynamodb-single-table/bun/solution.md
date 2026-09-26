# Day 05 dynamoDB single table

#### Solution for Part 1:

##### Pre-requists

Make sure you have docker is installed, if not refer the day-04 solution for reference for installation steps. I am re using the same code for bun which was designed in day 01 test, feel free to create new one, if you need to start fresh.

<b> AWS cli</b>: Install AWS cli
reference: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

Run the command `curl -fsSL https://awscli.amazonaws.com/v2/install.sh | bash` and `curl -fsSL https://awscli.amazonaws.com/v2/install.sh | sudo bash -s -- --system`

validate if AWS is installed `aws --version`

Created `docker-compose.yml` file and added below code

```
services:
  dynamodb-local:
    command: "-jar DynamoDBLocal.jar -sharedDb -dbPath ./data"
    image: "amazon/dynamodb-local:latest"
    container_name: dynamodb-local
    ports:
      - "8000:8000"
    volumes:
      - "./docker/dynamodb:/home/dynamodblocal/data"
    working_dir: /home/dynamodblocal
```

Once the compose file is created, run the command `docker compose up` to run docker,

- This will download dynamodb image if it is not present
- It will run an instance of dynamodb in docker

if the the above command is successful you should be able to see below in your console

```
[+] up 1/1
 ✔ Container dynamodb-local Created                                                                                                                         0.0s
Attaching to dynamodb-local
dynamodb-local  | Initializing DynamoDB Local with the following configuration:
dynamodb-local  | Port: 8000
dynamodb-local  | InMemory:     false
dynamodb-local  | Version:      3.3.1
dynamodb-local  | DbPath:       ./data
dynamodb-local  | SharedDb:     true
dynamodb-local  | shouldDelayTransientStatuses: false
dynamodb-local  | CorsParams:   null
dynamodb-local  |


v View in Docker Desktop   o View Config   w Enable Watch   d Detach

```

Create a default table to verify if it is present, `defaultTables.ts`

```
import {
  DynamoDBClient,
  CreateTableCommand,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({
  endpoint: "http://localhost:8000",
  region: "us-east-1",
  credentials: { accessKeyId: "local", secretAccessKey: "local" }, // dummy — Local doesn't check these
});

await client.send(
  new CreateTableCommand({
    TableName: "verify-table",
    AttributeDefinitions: [{ AttributeName: "PK", AttributeType: "S" }],
    KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
    BillingMode: "PAY_PER_REQUEST",
  }),
);

console.log(await client.send(new ListTablesCommand({})));
```

run the command `bun defaultTables.ts`

verify the tables is present `aws dynamodb list-tables --endpoint-url http://localhost:8000`

you should be able to see

```
{
    "TableNames": [
        "verify-table"
    ]
}
```

#### Part 2

##### Access patterns (written before touching any code)

| # | Access pattern | Key(s) it hits |
|---|---|---|
| 1 | Get a user by id | `GetItem` — `PK = USER#<userId>`, `SK = USER#<userId>` |
| 2 | Create/update a user | `PutItem` — same key as #1 |
| 3 | List all todos for a user | `Query` — `PK = USER#<userId>`, `SK begins_with "TODO#"` |
| 4 | Get one todo by id (owning user already known) | `GetItem` — `PK = USER#<userId>`, `SK = TODO#<todoId>` |
| 5 | Create/update a todo for a user | `PutItem` — same key as #4 |
| 6 | List all todos with a given status, across every user | `Query` on GSI1 — `GSI1PK = STATUS#<status>` |

Pattern 6 is the one the base table's keys genuinely cannot serve — `PK`
is always scoped to one user, so there's no way to ask "every todo across
every user with status X" without either a full table `Scan` (excluded by
the requirements) or a second index whose partition key is the status,
not the user. That's what `GSI1` is for.

##### Corrected key design

First attempt (`userTables.ts`, now replaced) modeled this as a `users`
table with a plain `userId` primary key and a `todos` string attribute —
which is a single-table-per-entity design wearing a DynamoDB SDK, not
single-table design. It also would have failed outright: `userName` was
declared in `AttributeDefinitions` but never referenced by any
`KeySchema`, which DynamoDB rejects with `ValidationException: Some
AttributeDefinitions are not used`.

Corrected design — one table (`app-table`), generic `PK`/`SK`, entity type
told apart by the `SK` prefix:

- User item: `PK = USER#<userId>`, `SK = USER#<userId>`
- Todo item: `PK = USER#<userId>`, `SK = TODO#<todoId>`, plus
  `GSI1PK = STATUS#<status>`, `GSI1SK = TODO#<todoId>` (only set on todo
  items — user items don't need to show up in the status index at all)

`AttributeDefinitions` only lists `PK`, `SK`, `GSI1PK`, `GSI1SK` — the
four attributes actually used by a key schema somewhere. `userName`,
`title`, `status`, etc. are ordinary item attributes and don't belong in
`AttributeDefinitions` at all; that's what caused the earlier failure.

```ts
import { DynamoDBClient, CreateTableCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({
  endpoint: "http://localhost:8000",
  region: "us-east-1",
  credentials: { accessKeyId: "local", secretAccessKey: "local" },
});

await client.send(
  new CreateTableCommand({
    TableName: "app-table",
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
      { AttributeName: "GSI1PK", AttributeType: "S" },
      { AttributeName: "GSI1SK", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "GSI1",
        KeySchema: [
          { AttributeName: "GSI1PK", KeyType: "HASH" },
          { AttributeName: "GSI1SK", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
    BillingMode: "PAY_PER_REQUEST",
  }),
);

console.log("app-table created with GSI1");
```

Example items this produces:

```json
{ "PK": "USER#u1", "SK": "USER#u1", "userName": "sachin" }
{ "PK": "USER#u1", "SK": "TODO#t1", "title": "learn dynamodb", "status": "pending", "GSI1PK": "STATUS#pending", "GSI1SK": "TODO#t1" }
```

A `Query` on the base table for `PK = USER#u1` returns both items — the
user's own profile and every one of their todos — in one round trip,
which is the actual payoff of single-table design: related entities that
you almost always fetch together live in the same partition.

The old `users` and `verify-table` tables from Part 1's verification step
are still sitting in DynamoDB Local — harmless to leave alone, since
Part 3's code only ever talks to `app-table`, but you can drop them with
`aws dynamodb delete-table --table-name users --endpoint-url http://localhost:8000`
if you want a clean slate.

#### Part 3 & Part 4: implemented and run for real

`index.ts` implements `createUser`, `createTodo`, `getUser`, `getTodo`,
`listTodosForUser` (base-table `Query`), and `listTodosByStatus` (GSI1
`Query`), using `DynamoDBDocumentClient` from `@aws-sdk/lib-dynamodb` so
plain JS objects go in and out — no manual `{ S: "..." }` attribute-value
wrapping.

Ran `bun install && bun index.ts` against the real `app-table` from
Part 2. Actual output:

```
--- getUser(u1) ---
{ SK: "USER#u1", userName: "sachin", PK: "USER#u1" }

--- listTodosForUser(u1)  [Query: PK + SK begins_with('TODO#')] ---
[
  { SK: "TODO#t1", PK: "USER#u1", title: "learn dynamodb", status: "pending", GSI1PK: "STATUS#pending", GSI1SK: "TODO#t1" },
  { SK: "TODO#t2", PK: "USER#u1", title: "write blog post", status: "done", GSI1PK: "STATUS#done", GSI1SK: "TODO#t2" }
]

--- getTodo(u1, t1)  [GetItem, exact PK+SK] ---
{ SK: "TODO#t1", PK: "USER#u1", title: "learn dynamodb", status: "pending", GSI1PK: "STATUS#pending", GSI1SK: "TODO#t1" }

--- listTodosByStatus('pending')  [Query on GSI1 — crosses u1 AND u2] ---
[
  { SK: "TODO#t1", PK: "USER#u2", title: "review pr", status: "pending", GSI1PK: "STATUS#pending", GSI1SK: "TODO#t1" },
  { SK: "TODO#t1", PK: "USER#u1", title: "learn dynamodb", status: "pending", GSI1PK: "STATUS#pending", GSI1SK: "TODO#t1" }
]
```

This is the actual payoff, confirmed rather than assumed: `listTodosForUser("u1")`
correctly returns only u1's two todos and nothing of u2's, even though
they share the same table — the `SK begins_with("TODO#")` condition does
the filtering inside one partition. `listTodosByStatus("pending")` then
returns todos from **both** `u1` and `u2` in a single `Query` against
`GSI1` — the exact access pattern the base table's `PK` (always scoped to
one user) has no way to serve without a table-wide `Scan`.

## Key concepts learned

- Single-table design means one table, generic `PK`/`SK` names, and
  entity type encoded in the key values themselves (`USER#` vs `TODO#`
  prefixes) rather than in the table's shape. The schema doesn't know
  what a "user" or "todo" is — the application does.
- `AttributeDefinitions` in `CreateTableCommand` is not a schema for your
  item shape — DynamoDB is schemaless for non-key attributes. It's
  strictly the list of attributes used by some `KeySchema` (base table or
  a GSI), and DynamoDB rejects the call if you list one that isn't.
- A composite primary key (`PK` + `SK`) is what lets one partition hold
  more than one *kind* of item. A simple key (just `PK`) caps you at one
  item per key, which is why the first attempt — `userId` as a lone hash
  key — couldn't actually model a user-with-many-todos relationship at
  all, regardless of what got stuffed into a `todos` attribute.
- A GSI is a second index over the same table with its own partition
  key, used specifically for access patterns the base table's key can't
  serve. Not every item needs to appear in it — only todo items carry a
  `GSI1PK`/`GSI1SK` here, since "list users by status" isn't a real
  access pattern.
- `DynamoDBDocumentClient.from(client)` wraps the low-level
  `DynamoDBClient` and marshals plain JS values to/from DynamoDB's
  `{ S, N, ... }` attribute-value format automatically — worth reaching
  for by default over the raw client once you're past table admin.

## Code walkthrough

- `userTables.ts` — creates `app-table` with a composite `PK`/`SK` and
  `GSI1`, per the access-pattern list above.
- `index.ts` — CRUD helpers plus a demo run: 2 users, 3 todos split
  across them, then all four access patterns exercised for real.

## Gotchas / things that tripped me up

1. First schema attempt was a `users` table with a plain `userId` key and
   a `todos` string attribute — one-table-per-entity thinking, not
   single-table design, and it also declared an unused `userName`
   attribute that would have made `CreateTableCommand` fail outright with
   `ValidationException: Some AttributeDefinitions are not used`.
2. Wrote the access-pattern list *after* the first schema attempt instead
   of before, which is exactly backwards — the point of writing patterns
   down first is catching a design like #1 before any code gets written.
3. Only todo items need `GSI1PK`/`GSI1SK` — putting them on user items
   too would work, but adds nothing, since "list users by status" isn't a
   pattern anyone needs.

## What I'd do differently

- Add the `TransactWriteCommand` bonus — mark a todo done and bump a
  `completedCount` on the user item atomically — and actually simulate
  one half failing to see the rollback.
- Add DynamoDB's native TTL on completed todos and write down concretely
  how it differs from Day 4's Redis TTL (DynamoDB's TTL deletion is
  background and can lag actual expiry by minutes, not immediate like a
  Redis key expiring).
- `BatchWriteCommand` for seeding todos instead of three separate
  `PutCommand` calls.

## Further reading

- https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html
- https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GSI.html
- https://github.com/aws/aws-sdk-js-v3/blob/main/lib/lib-dynamodb/README.md
