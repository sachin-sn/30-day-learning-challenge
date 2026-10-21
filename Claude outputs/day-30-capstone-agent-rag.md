---
title: "Day 30 — One Traced Request Through My Agent, Embeddings and pgvector"
date: "2026-10-21"
excerpt: "For the last day I connected three earlier pieces, an agent loop, local embeddings and pgvector, and timed one request through all of them. The model calls took almost all the time, not the search."
tags: ["30-day-challenge", "day-30", "agent", "rag", "pgvector", "tracing", "nodejs"]
draft: true
---

Day 30 is the last day. The idea was to stop learning one new thing and instead connect
three things I already built, then watch one request go through all of them. It is the
short 90-minute format.

## What I connected

The starter code came with the challenge, written by Claude, and my job was to run it
and measure it. It reuses my own code from earlier days by import:

- the agent loop from Day 25, which calls the model and runs tools,
- the embedding model from Day 22 (`Xenova/all-MiniLM-L6-v2`, 384 numbers per text),
- the pgvector table from Day 23, running in Docker.

The agent has one tool, `search_docs`. It turns the query into a vector, asks pgvector
for the 3 closest notes, and gives them back to the model as text. Every step is wrapped
in a timer, and at the end the program prints a trace and writes a Mermaid sequence
diagram built from the real timings. The model was `claude-opus-5-5`.

Before the capstone I ran the Day 23 `query.js` again: the top 3 were the same as the
Day 22 results for 5 of 5 questions.

I wrote two predictions before running anything. I said the agent would need 3 model
calls for the question "Why do some of my workers sit idle when I add more of them to
read the same stream?". For the second run of the same question, I said the pgvector
query would take the most time. I did not give a number of milliseconds.

## The trace

I ran the question twice in one process. This is the second run:

```
start (ms)  took (ms)  span
         0      10118  agent.request  steps=2
         0       5125    llm.call 1  stop_reason=tool_use
      5125         24    tool.search_docs  query=consumers idle when adding more consumers to same stream
      5125         12      embed
      5138         12      pgvector.query  top=kafka 0.513, redis 0.153, websocket 0.150
      5150       4968    llm.call 2  stop_reason=end_turn
```

Both of my predictions were wrong. The agent used 2 model calls in both runs, not 3: the
first call asked for the search, the second wrote the answer. And the two model calls
took 5125 ms and 4968 ms, while the embedding and the pgvector query took 12 ms each. In
run 1 the model calls took 1901 ms and 3330 ms, the embedding 151 ms and the pgvector
query 28 ms.

The two runs were not the same request. The model wrote a different search text each
time ("...to same topic" in run 1, "...to same stream" in run 2), so the scores changed
(kafka 0.562 against 0.513). Run 2 took longer overall, 10118 ms against 5411 ms,
because the model calls were slower, not because of the search. Both answers said that
a Kafka consumer group gives each partition to one consumer, so extra consumers sit
idle, and both said that the notes only cover Kafka.

## When the database is stopped

I ran `docker stop pgv` and asked the same question once. The agent did not crash:

```
         0      18221  agent.request  steps=3
         1       5289    llm.call 1  stop_reason=tool_use
      5289        169    tool.search_docs  ERROR: ECONNREFUSED
      5289        165      embed
      5455          3      pgvector.query  ERROR: ECONNREFUSED
      5458       3193    llm.call 2  stop_reason=tool_use
      8651          9    tool.search_docs  query=Kafka consumer group idle consumers partitions  ERROR: ECONNREFUSED
      8660       9561    llm.call 3  stop_reason=end_turn
```

The error shows first on `pgvector.query`, after 3 ms. The tool catches it and returns
it to the model as text. The model tried a second search with a different query, got the
same error, and then answered. The answer began with "I couldn't reach your notes", said
it was from general knowledge, and then explained the partition limit. So this is the
one case where 3 model calls was right.

## Two more cases

For "What is the capital of France?" the agent used 1 model call and did not search.
The tool description in `search.js` lists the note topics, and the answer said the notes
don't cover this, then gave Paris from general knowledge.

By mistake I also ran the program with an empty question. The API returned a 400 error,
"user messages must have non-empty content". The trace showed the error on `llm.call 1`
after 530 ms, and then the program ended with a stack trace, because errors from the
model call are not caught in `run.js`. Only errors inside tools are caught.

## What this does not show

It is one question on one machine, with 10 short notes in the table. I did not time other
questions, other models, a larger table, or streaming. I did not test what happens when
the embedding step fails. The model-call times varied a lot between runs (1.9 s to
5.1 s for the same first step), and I do not know why. I did not use OpenTelemetry; the
trace is a small timer I could read in full. I only judged one answer for quality, not
retrieval quality across many questions.

## Thank you

Thank you to everyone who followed along for these 30 days, read the posts, and sent
comments. It meant a lot that people kept coming back. Thank you also to Claude, which
helped me plan the days, wrote the starter code for the challenges, and helped me check
my results. I learned a lot from the work, and from being wrong about my own predictions.

## What's next

Day 30 was the last day of this challenge. What I do next is not decided yet. Full code
in the [repo](#) — `day-30-capstone-agent-rag/`.
