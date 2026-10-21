# Day 30 — Capstone: One Question Through the Agent, the Tool, the Embedding Model and pgvector

Short format (about 90 minutes). Two earlier pieces are connected: the agent loop from Day 25 gets a
`search_docs` tool, and that tool uses the embedding code from Day 22 and the pgvector table from Day 23.
One question travels through all of it, and you read the trace of that one request.

```
question -> agent loop (Day 25) -> Claude API -> search_docs tool -> embedding model (Day 22) -> pgvector (Day 23)
                                        ^                                                          |
                                        +------------------------- tool result ---------------------+
```

The code was written by Claude (`trace.js`, `search.js`, `agent.js`, `run.js` in `src/`). You read it, run it and
read the trace. `search.js` imports the Day 22/23 files from their own folders instead of copying them.

## Predictions (5 min) — write them in `solution.md` BEFORE running anything

1. How many model calls (steps) will the agent need to answer the default question?
2. In the second run of the same question (same process), which part of the trace takes the most time: the model calls, the embedding, or the pgvector query? And about how many milliseconds?

## Part A: run it (about 40 min)

1. Check that the Day 23 database is still there: `docker ps`. If `pgv` is not running, `docker start pgv`. If the container is gone, redo Day 23: the `docker run` command from its `challenge.md`, then `node load.js` in its `src` folder.
2. In `day-23-vector-database-pgvector/src`, run `node query.js` once. If it prints the 5 questions with pgvector results, the database is ready.
3. In `day-30-capstone-agent-rag/src`: `npm install`. Key in the shell only: `export ANTHROPIC_API_KEY=...` (never in a file).
4. Read `trace.js`, `search.js`, `agent.js`, `run.js`. Find the 4 places where a span is created.
5. `node run.js` (default question, 2 runs in the same process). Paste the whole output.
6. Look at `traces/run-1.mmd` and `traces/run-2.mmd`: Mermaid diagrams generated from the real spans of each run. Open one in a Markdown preview that supports Mermaid (GitHub does, once committed).

## Part B: look and break (about 30 min)

1. Compare run 1 and run 2: which span is much slower in run 1, and by how much?
2. Break it: `docker stop pgv`, then `node run.js "Why do some of my workers sit idle when I add more of them to read the same stream?" 1`. Where does the error show in the trace? What does the model answer? Then `docker start pgv`.
3. Ask something that is not in the notes: `node run.js "What is the capital of France?" 1`. Does the model call the tool? What top results and scores come back?
4. Keep the diagram you like: `cp traces/run-2.mmd ../trace-run-2.mmd` (the `traces/` folder itself is not committed).

## Save in `solution.md`

- The output of Part A step 5 (both traces and the answer).
- Which part took the most time in run 2, and the numbers.
- What the trace and the answer looked like with Docker stopped.
- What happened with the off-topic question: tool called or not, the scores.
- Anything in the trace you did not expect.

## Not today

OpenTelemetry (this tracer is 50 lines, not a real standard), streaming, more tools, better retrieval,
changing the prompt, fixing the model's answers.
