# Day 30 — Capstone: Agent + RAG, One Traced Request

## Predictions (written by Sachin before running anything)

1. How many model calls (steps) will the agent need to answer the default question? **3**
2. In the second run of the same question (same process), which part of the trace takes the most time: the model calls, the embedding, or the pgvector query? And about how many milliseconds? **the pgvector query**
   - Note: no number of milliseconds was given, so that part is not predicted.

## Output

### Part A: `node run.js` (default question, 2 runs)

Model: `claude-opus-5-5`. Question: "Why do some of my workers sit idle when I add more of them to read the same stream?"

```
run 1 (first run in this process)
start (ms)  took (ms)  span
         0       5411  agent.request  steps=2
         0       1901    llm.call 1  step=1  stop_reason=tool_use  in_tokens=544  out_tokens=63
      1902        179    tool.search_docs  query=consumers idle when adding more consumers to same topic
      1902        151      embed  model=Xenova/all-MiniLM-L6-v2  dims=384
      2053         28      pgvector.query  limit=3  top=kafka 0.562, redis 0.074, websocket 0.074
      2081       3330    llm.call 2  step=2  stop_reason=end_turn  in_tokens=787  out_tokens=247

run 2
start (ms)  took (ms)  span
         0      10118  agent.request  steps=2
         0       5125    llm.call 1  step=1  stop_reason=tool_use  in_tokens=544  out_tokens=63
      5125         24    tool.search_docs  query=consumers idle when adding more consumers to same stream
      5125         12      embed  model=Xenova/all-MiniLM-L6-v2  dims=384
      5138         12      pgvector.query  limit=3  top=kafka 0.513, redis 0.153, websocket 0.150
      5150       4968    llm.call 2  step=2  stop_reason=end_turn  in_tokens=787  out_tokens=265
```

Both answers said Kafka allows one consumer per partition in a group, so extra consumers sit idle, and both said the notes only cover Kafka. Run 2 added a part marked as beyond the notes (raise the partition count, key order can change).

Before this, `node query.js` in Day 23 gave "same top 3 (ids and order): 5 of 5" against Day 22.

What I see in the output (not yet checked beyond this):

- Prediction 1 (3 model calls): both runs used 2 model calls (step 1 stop_reason=tool_use, step 2 end_turn).
- Prediction 2 (pgvector query is the slowest part in run 2): not what the trace shows. The two model calls took 5125 ms and 4968 ms. Embedding and pgvector query took 12 ms each in run 2. In run 1 they were 151 ms and 28 ms.
- The model wrote a different search query in each run ("same topic" vs "same stream"), so the scores differ (kafka 0.562 vs 0.513). The second run is not the same request as the first.
- Run 2 took longer overall (10118 ms vs 5411 ms) because the model calls were slower, not the search.

### Part B

- Run 1 vs run 2 (where did the time change?): see "What I see" under Part A. The model calls took 1901 + 3330 ms in run 1 and 5125 + 4968 ms in run 2; embedding and pgvector went from 151 + 28 ms to 12 + 12 ms.
- Side finding (my mistake in the command, not planned): `node run.js "" 1` (empty question) failed at `llm.call 1` after 530 ms with a 400 from the API, "user messages must have non-empty content". The trace showed the ERROR on `agent.request` and `llm.call 1`, then `run.js` ended with a stack trace, because errors from the model call are not caught (errors inside tools are caught).
- `docker stop pgv`, then 1 run (default question):

```
start (ms)  took (ms)  span
         0      18221  agent.request  steps=3
         1       5289    llm.call 1  step=1  stop_reason=tool_use
      5289        169    tool.search_docs  query=consumers idle when adding more consumers to same topic  ERROR: ECONNREFUSED
      5289        165      embed  model=Xenova/all-MiniLM-L6-v2  dims=384
      5455          3      pgvector.query  limit=3  ERROR: ECONNREFUSED
      5458       3193    llm.call 2  step=2  stop_reason=tool_use
      8651          9    tool.search_docs  query=Kafka consumer group idle consumers partitions  ERROR: ECONNREFUSED
      8651          7      embed  model=Xenova/all-MiniLM-L6-v2  dims=384
      8658          2      pgvector.query  limit=3  ERROR: ECONNREFUSED
      8660       9561    llm.call 3  step=3  stop_reason=end_turn
```

  The error shows first on `pgvector.query` (3 ms), and the same error is on its parent `tool.search_docs`. Embedding still worked before it. `agent.request` has no ERROR: the tool error went back to the model as text, the model tried a second search with a different query, got the same error, and then answered. The answer started with "I couldn't reach your notes", said it was from general knowledge and not from the notes, and then gave the Kafka partition explanation, with offers to adjust or try again later. Here the agent used 3 model calls (the default question with the database up used 2 each time).
- Off-topic question "What is the capital of France?" (database up, 1 run): 1 model call, no `search_docs` call, 3832 ms in total (3831 ms was the model call). The answer said the notes don't cover it, named their topics, and gave "Paris" from general knowledge. The topic list is in the tool description in `search.js` (JWT, Kafka, Redis, Docker, ...), so the model could decide without searching.
- Diagram saved as `trace-run-2.mmd` in this folder: it is the default question's run 2 (the search text "...to same stream"), copied before any later run could overwrite it. Each new run writes `traces/run-1.*` again, so the first default run's files were overwritten by the later runs.

## What I learned

TODO: three sentences, written by Sachin.

## Not measured / still open

TODO

## Link

TODO: docs link
