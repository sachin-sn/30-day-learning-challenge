---
title: "Day 5 — One Table, Two Entities, One Mistake"
date: "2026-09-26"
excerpt: "DynamoDB single-table design. My first schema was a users table with a todos field bolted on — the exact anti-pattern the exercise exists to break."
tags: ["30-day-challenge", "day-05", "dynamodb", "aws", "nosql"]
draft: true
---

Four days of Bun, Zod, tRPC and Redis kept todos in memory. Today's about
making them survive a restart — but DynamoDB punishes relational habits
more than it rewards them. The standard advice is one table, multiple
entity types, told apart by a generic `PK`/`SK` pair. My first instinct
proved why that advice exists.

## What I built first (wrong)

A `users` table. Simple `userId` key. A `todos` attribute to hold — what,
exactly? One partition key value can only ever address one item, so
there was no real way to store a user's profile *and* several distinct
todos under it. It also would have failed to even create: I'd declared a
`userName` attribute DynamoDB never actually used in any key, which
throws `ValidationException: Some AttributeDefinitions are not used`.
`AttributeDefinitions` isn't a schema for your item shape — it's strictly
the attributes some key schema references, nothing else.

## What actually works

One table. Composite key. Entity type lives in the key values, not the
table shape:

```
User: PK = USER#u1,  SK = USER#u1
Todo: PK = USER#u1,  SK = TODO#t1   (+ GSI1PK = STATUS#pending, GSI1SK = TODO#t1)
```

A `Query` on `PK = USER#u1` returns the user's profile *and* every one of
their todos in one round trip — the actual point of single-table design:
things you fetch together, live together.

## Proving the two patterns that matter

```
listTodosForUser("u1")   → returns only u1's 2 todos, filtered by
                            SK begins_with("TODO#") inside one partition

listTodosByStatus("pending") → returns todos from BOTH u1 AND u2 —
                            a Query on GSI1, not the base table
```

That second one is the point of adding a GSI at all: the base table's
`PK` is always scoped to one user, so "every pending todo across every
user" has no path through it except a full `Scan` — excluded by design
today. `GSI1PK = STATUS#<status>` gives that access pattern its own
index instead.

## The lesson underneath both mistakes

Write the access patterns down *before* the schema, not after. I did it
backwards — schema first, patterns as an afterthought — and got exactly
the one-table-per-entity design the exercise is built to catch. The fix
wasn't cleverer code, it was going back to "what do I actually need to
ask this table" and letting the keys follow from that.

## What's next

Day 6: full code in the
[repo](#) — `day-05-dynamodb-single-table/`.
