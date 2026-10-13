---
title: "Day 22 — I Guessed 4 Numbers per Embedding. It Was 384"
date: "2026-10-13"
excerpt: "I embedded ten short texts with a model that runs on my Mac and asked five questions that share almost no words with the right answer. The right text was first every time, but one question was a close call."
tags: ["30-day-challenge", "day-22", "rag", "embeddings", "nodejs", "retrieval"]
draft: true
---

Day 21 called an LLM. Day 22 looks at the step before that call in a RAG setup:
finding the texts that match a question. I have built RAG features at work, but
mostly looked at the answers. Today I looked at the retrieval alone, on ten texts
I could read, with no LLM and no database. It is the short 90-minute format again.

## The setup

I used `@huggingface/transformers` in Node with the model `Xenova/all-MiniLM-L6-v2`.
It runs on my Mac, so there is no API key and no cost. (The Claude API has no
embeddings endpoint as far as I know, so I needed another option.) The first run
downloaded the model. The code is small: `embed(text)` returns an array of
numbers, `cosine(a, b)` compares two arrays, and `topK` sorts the ten texts by
that score. The ten texts are short statements about things from earlier days:
Kafka, Docker, JWT, Redis, Kubernetes and so on.

I wrote two predictions before I ran anything. How many numbers does one
embedding have? I said 4. For how many of five questions would the right text be
in the top 3? I said 3.

## 384 numbers

```
model load:           3414 ms (first run), 139 to 208 ms on later runs
embedded 10 texts:    50 ms
vector size:          384
```

My 4 was wrong, and 384 is far from it. Embedding the ten texts took about 50 ms.

My first question was "how do I keep a token from being edited". The JWT text
came first with 0.315. The second place was the rate-limit text with 0.256, which
shares the word "token" and is about something else. The right text and the
question share almost no words, and it still came first.

## Five questions

The ten texts and the five questions came with the starter code, written by Claude
and not by me. The questions avoid the key words of the right text.
For example "Why do some of my workers sit idle when I add more of them to read the
same stream?" for the Kafka text about partitions and consumers.

```
question        right text   score   2nd place          score
Q1 idle workers kafka        0.389   websocket          0.199
Q2 dev tools    docker       0.514   k8s                0.179
Q3 live traffic k8s          0.427   docker             0.242
Q4 too many req ratelimit    0.335   websocket          0.317
Q5 which cloud  terraform    0.497   k8s                0.289
```

The right text was first in all five, so 5 of 5 in the top 3. My prediction of 3
was too low. Two questions of my own gave 0.240 (rate limit) and 0.556 ("what is
kafka"). The short question with the product name scored highest of everything I
ran.

## The close call

Q4 is the one I would worry about. The right text scored 0.335, the lowest top
score of the five, and the second place (the WebSocket text) was only 0.018 behind,
with the gRPC text third. In the other four questions the gap between first and
second place was 0.185 or more. I do not know why Q4 was close, and I did not test
it. <!-- TODO (Sachin): your own reason for Q4, marked as a guess if you did not test it -->

One more detail: the first question took 239 ms to embed and the next four took 3
to 6 ms each.

## What I'm leaving open

Ten texts and five questions, all written by the same author, so 5 of 5 says
little about quality on real documents. I did not reword Q4 or its text to see what
changes. No other embedding model, no chunking of long documents, no vector
database and no LLM answer step. I embedded ten texts in 50 ms and did not measure
a larger set.

## What's next

Day 23 puts the same vectors in a vector database (pgvector or Chroma, in Docker)
and runs the same five questions again. Full code in the [repo](#) —
`day-22-rag-embeddings/`.
