---
title: "Day 23 — I Guessed 200 ms. Searching 20,000 Vectors Took 7"
date: "2026-10-14"
excerpt: "I moved my Day 22 vectors into pgvector, asked the same five questions through SQL and got identical results. Then I added 20,000 random vectors and an HNSW index. The search went from 7.1 ms to 1.6 ms, and my guesses were far too high."
tags: ["30-day-challenge", "day-23", "pgvector", "postgres", "vector-database", "docker", "rag"]
draft: true
---

Day 22 searched ten texts in memory with a few lines of JavaScript. Day 23 asks what
changes when the vectors live in a database. I used pgvector, which is Postgres
with a vector column type, running in Docker. Same vectors, same five questions,
and then an index. It is the short 90-minute format again.

## Getting the database up

Two small things went wrong before the first query. I pasted the `docker run`
command without its last part, the image name, and Docker told me it needs at least
one argument. Then Docker said it could not connect to its API, because the Docker
service was not running. After I started it, this worked:

```
docker run -d --name pgv -e POSTGRES_PASSWORD=test -p 5433:5432 pgvector/pgvector:pg16
```

The password is a test value and the port is 5433 so it does not clash with a
local Postgres.

## The same five questions through SQL

Before I ran anything I wrote two predictions. My first one was that the results
would be the same as on Day 22. The second was about speed, and I come to it below.

The table has an id, the text and a `vector(384)` column. The search is one query
that orders by `embedding <=> $1`, where `<=>` is the cosine distance in pgvector,
and the score is `1 - distance`.

```
Q1  kafka 0.389 | websocket 0.199 | otel 0.149         same as Day 22
Q2  docker 0.514 | k8s 0.179 | terraform 0.124         same
Q3  k8s 0.427 | docker 0.242 | kafka 0.239             same
Q4  ratelimit 0.335 | websocket 0.317 | grpc 0.279     same
Q5  terraform 0.497 | k8s 0.289 | docker 0.221         same
```

All five gave the same three texts, in the same order, with the same scores to
three decimals. My prediction was right. It is what I would expect: both searches
use cosine similarity on the same stored numbers, and only the place where the
maths happens changed.

## 20,000 more rows, with and without an index

With ten rows nothing would show, so I added 20,000 random vectors with 384
numbers each. They are not real text embeddings, just random numbers. Then I timed
one search 20 times, built an HNSW index (it took 4.8 seconds), and timed it again.

```
                 rows     median   min      max      plan
no index         20,010   7.1 ms   6.3 ms   8.5 ms   Parallel Seq Scan, 2 workers
HNSW index       20,010   1.6 ms   1.2 ms   6.1 ms   Index Scan using docs_hnsw
```

My guesses were 200 ms without an index and 20 ms with one. Both were far too
high. Without an index the database read all 20,010 rows with two parallel
workers and sorted them, and that took 7 ms. With the index, the plan changed to an
index scan and the search took 1.6 ms, which is 4.4 times faster by the median. I
had guessed 10 times.

The part I will remember is that the plan is where you can see the index being
used. Before the index, the plan shows a scan of the whole table. After it, the
line says `Index Scan using docs_hnsw`. Timing alone would not have told me that
the plan changed.

## What I'm leaving open

My query in `query.js` has a filter (`WHERE id NOT LIKE 'rand-%'`), and I did not
look at its plan. After the index, all five questions still gave the same top 3,
but I do not know if that query used the index, so this result may say nothing about
the index. HNSW is an approximate search, and I did not compare its results with
the full scan, so I did not measure how often it misses. It was one question, 20
runs, one machine. The slowest run with the index was 6.1 ms and I did not look
into why. The vectors were random, so real embeddings may behave differently. I did
not change any HNSW settings, and I did not try Chroma.

## What's next

Day 24 is an MCP server with two tools. Full code in the [repo](#) —
`day-23-vector-database-pgvector/`.
