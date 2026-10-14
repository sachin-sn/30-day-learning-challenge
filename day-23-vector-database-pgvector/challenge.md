# Day 23 — Vector Database: pgvector, Same Questions, Then an Index

**Time box:** 90 minutes. Part A about 40 min, Part B about 30 min, notes about 15 min.
If a part runs over by 15 minutes, stop, write down where you stopped, and move on.
**Tech stack:** Docker (`pgvector/pgvector:pg16`), PostgreSQL, Node.js 22, the `pg` library

## Why this matters

"Which vector database would you use, and why?" is a common RAG interview question. pgvector is
the easy answer for teams that already run Postgres: vectors are a column type and search is SQL.
Today you move the Day 22 vectors into it, ask the same 5 questions, and then see what an index
does to speed and to results. An index is not always used, so you also look at the query plan.

## Predictions (write these first, 5 min)

Put them in `solution.md` before you run any code.

1. You ask the same 5 questions as on Day 22, now through SQL. For how many of the 5 will the top 3
   (same texts, same order) be exactly the same as on Day 22?
2. After you add 20,000 extra (random, synthetic) vectors: how many milliseconds does one search take
   without an index, and how many times faster (or slower) will it be with an HNSW index?
   (Two numbers; guesses are fine.)

## Part A — Build it (about 40 min)

1. Start the database (test values only; port 5433 avoids a clash with a local Postgres):

   ```
   docker run -d --name pgv -e POSTGRES_PASSWORD=test -p 5433:5432 pgvector/pgvector:pg16
   ```

2. In `src/`: `npm install`.
3. `node load.js` creates the table (`vector(384)`) and loads the 10 Day 22 vectors from
   `../../day-22-rag-embeddings/src/vectors.json`.
4. `node query.js` asks the 5 questions from Day 22 through SQL and compares the top 3 with an
   in-memory search on the same vectors. Read the SQL in `query.js`. Be ready to explain what
   `<=>` is and why the score is `1 - distance`.

Done looks like: 10 rows in the table, and you know how many of the 5 questions came back the same.

## Part B — Measure it (about 30 min)

1. `node fill.js` adds 20,000 random 384-number vectors (synthetic, not real text embeddings).
2. `node bench.js` times one search 20 times and prints the query plan. This is "before".
3. `node index.js create` builds an HNSW index (it prints how long that took). Run `node bench.js`
   again. This is "after". Look at the plan: is the index used?
4. Run `node query.js` again. Do the 5 questions still return the same top 3 as before the index?

## Save this output

- The result of `query.js` (same or different from Day 22, per question)
- The `bench.js` output before and after the index (min and median ms, and the plan line)
- The time to build the index
- Whether `query.js` gave the same results after the index

## Clean up

`docker stop pgv && docker rm pgv`

## Not part of today

Chroma, filters combined with vector search, tuning HNSW settings, and real documents. Do not
tune anything until the first "before" and "after" runs are saved.

## Resources

- https://github.com/pgvector/pgvector
- https://hub.docker.com/r/pgvector/pgvector
