# Day 23 — Solution: Vector Database with pgvector

> Status: done (docs link and the TODOs about my predictions still to fill in).

## Predictions (written before the work)

1. For how many of the 5 questions will the top 3 (same texts, same order) be exactly the same as on Day 22?
   Prediction: "yes" (no number; I read it as all 5, TODO: confirm) — result: right under that reading. 5 of 5 were the same, with the same ids, the same order and the same scores to 3 decimals.
2. After adding 20,000 random vectors: how many milliseconds does one search take without an index, and how many times faster or slower with an HNSW index?
   Prediction: "200ms, 20ms" (I read it as 200 ms without an index and 20 ms with one, which would be 10 times faster; TODO: confirm) — result: without an index the median was 7.1 ms (min 6.3) against my 200 ms. With the HNSW index the median was 1.6 ms (min 1.2) against my 20 ms. That is 4.4 times faster by the median (5.3 times by the min), not 10 times.

## Output

### Part A

```
$ node load.js
table docs has 10 rows, vector size 384

$ node query.js        (no index, 10 rows)
Q1  pgvector: kafka 0.389 | websocket 0.199 | otel 0.149        SAME as Day 22
Q2  pgvector: docker 0.514 | k8s 0.179 | terraform 0.124        SAME
Q3  pgvector: k8s 0.427 | docker 0.242 | kafka 0.239            SAME
Q4  pgvector: ratelimit 0.335 | websocket 0.317 | grpc 0.279    SAME
Q5  pgvector: terraform 0.497 | k8s 0.289 | docker 0.221        SAME
same top 3 (ids and order): 5 of 5
```

(Day 22 column left out because it is identical to the pgvector line in all five questions.)

### Part B

```
$ node fill.js
added 20000 random vectors in 10.8 s; table has 20010 rows

$ node bench.js        (before the index)
rows: 20010   indexes: docs_pkey
20 runs: min 6.3 ms   median 7.1 ms   max 8.5 ms
plan:
  Limit  (actual time=5.124..6.954 rows=3 loops=1)
    -> Gather Merge  (Workers Planned: 2, Workers Launched: 2)
         -> Sort  (Sort Method: top-N heapsort  Memory: 25kB)
              -> Parallel Seq Scan on docs  (actual time=0.009..2.930 rows=6670 loops=3)
  Planning Time: 0.036 ms
  Execution Time: 6.970 ms

$ node index.js create
created HNSW index in 4.8 s

$ node bench.js        (after the index)
rows: 20010   indexes: docs_pkey, docs_hnsw
20 runs: min 1.2 ms   median 1.6 ms   max 6.1 ms
plan:
  Limit  (actual time=1.257..1.261 rows=3 loops=1)
    -> Index Scan using docs_hnsw on docs  (actual time=1.257..1.260 rows=3 loops=1)
         Order By: (embedding <=> '[...]'::vector)
  Planning Time: 0.037 ms
  Execution Time: 1.272 ms

$ node query.js        (after the index)
same top 3 (ids and order): 5 of 5      (all five SAME, scores identical to before)
```

(The 384-number query vector in each plan line is cut out as `[...]`.)

|            | rows   | median | min    | max    | plan                         | execution time |
| ---------- | ------ | ------ | ------ | ------ | ---------------------------- | -------------- |
| no index   | 20,010 | 7.1 ms | 6.3 ms | 8.5 ms | Parallel Seq Scan, 2 workers | 6.970 ms       |
| HNSW index | 20,010 | 1.6 ms | 1.2 ms | 6.1 ms | Index Scan using docs_hnsw   | 1.272 ms       |

The index took 4.8 s to build. The 20,000 added rows were random numbers, not real text embeddings.

## What I learned (3 sentences at most)

The 5 questions gave the same top 3 and the same scores through pgvector as in memory on Day 22. With 20,010 rows one search took 7.1 ms (median) with a parallel sequential scan and 1.6 ms (median) with an HNSW index, which is 4.4 times faster, and the plan changed to an Index Scan. My guesses of 200 ms and 20 ms were both far too high.

## Not measured / still open

- `query.js` has a `WHERE id NOT LIKE 'rand-%'` filter. I did not look at its query plan, so I do not know if it used the index after the index was built. The "5 of 5 same" after the index may not say anything about the index.
- HNSW is an approximate search. I did not compare the top 3 from the index with the top 3 from the sequential scan for the random vectors, so I did not measure recall.
- One question, 20 runs, one machine, a local Docker container. The max after the index (6.1 ms) is higher than the others, and I did not look into why.
- The 20,000 vectors are random numbers, so the speed on real embeddings may differ. No HNSW settings were changed. Chroma was not tried.

## Link

- https://github.com/pgvector/pgvector
  - An HNSW index creates a multilayer graph. It has better query performance than IVFFlat (in terms of speed-recall tradeoff), but has slower build times and uses more memory. Also, an index can be created without any data in the table since there isn’t a training step like IVFFlat.
