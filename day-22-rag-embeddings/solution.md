# Day 22 — Solution: RAG Basics with Embeddings

> Status: done (my own reason for the weakest result, the docs link and one TODO in Part B still to fill in).

## Predictions (written before the work)

1. How many numbers (dimensions) will one embedding vector have?
   Prediction: "4" — result: wrong. The vector size is 384.
2. For how many of the 5 questions will the right text be in the top 3?
   Prediction: "3" — result: wrong. 5 of 5 (the expected text was ranked first in every question; TODO: confirm by my own reading).

## Output

### Part A (`node search.js "how do I keep a token from being edited"`)

```
model: Xenova/all-MiniLM-L6-v2
model load: 3414 ms
embedded 10 texts: 50 ms
vector size: 384
first 5 numbers of the first vector: [ -0.1023, 0.0184, 0.0731, -0.0451, 0.0791 ]
wrote vectors.json

question: how do I keep a token from being edited
1. 0.315  [jwt] A JWT carries claims in a signed token. The signature lets a server detect any c...
2. 0.256  [ratelimit] A token bucket limits how often a client can call an API. Tokens refill at a ste...
3. 0.168  [redis] Redis can delete a key automatically after a time to live. Setting an expiry on ...
```

The question has no word in common with the right text except "token", and the right text (jwt) was still first.
The second place (ratelimit) shares the word "token" but is about something else.

My own questions (`search.js`):

```
"how do I achieve rate limit"   1. 0.240 [ratelimit]   2. 0.121 [redis]       3. 0.056 [kafka]
"what is kafka"                 1. 0.556 [kafka]       2. 0.171 [k8s]         3. 0.114 [grpc]
```

The model load took 208 ms and 139 ms on these later runs, against 3414 ms on the first run.

### Part B (`node eval.js`, scores trimmed to the ids)

```
Q1 Why do some of my workers sit idle when I add more of them to read the same stream?
   expected kafka      1. 0.389 kafka   2. 0.199 websocket  3. 0.149 otel
Q2 How do I keep compilers and dev tools out of the container I ship?
   expected docker     1. 0.514 docker  2. 0.179 k8s        3. 0.124 terraform
Q3 What decides whether live traffic is sent to a container that just started?
   expected k8s        1. 0.427 k8s     2. 0.242 docker     3. 0.239 kafka
Q4 How can a server stop one caller from sending too many requests per second?
   expected ratelimit  1. 0.335 ratelimit  2. 0.317 websocket  3. 0.279 grpc
Q5 Where does the tool remember which cloud resources already exist?
   expected terraform  1. 0.497 terraform  2. 0.289 k8s       3. 0.221 docker

script count: 5 of 5 in top 3
```

Embedding time per question: 239 ms for Q1, then 3 to 6 ms for Q2 to Q5.

Weakest result: Q4. The right text scored 0.335, the lowest top score of the five, and the second place (websocket, 0.317)
was only 0.018 behind it, with grpc (0.279) third. In the other four questions the gap between 1st and 2nd was 0.185 or more (Q3 was the smallest of them).
Reason: TODO (my own reason; mark it as a guess if I did not test it).

## What I learned (3 sentences at most)

The embedding vectors have 384 numbers, so my 4 was wrong, and the right text was in the top 3 for 5 of 5 questions, so my 3 was wrong too. The questions were worded without the key words of the right text, and it still came first every time, but for one question the second place was only 0.018 behind. With 10 short texts, 5 of 5 does not tell me how it would do on a larger or messier set.

## Not measured / still open

- Only 10 texts and 5 questions, all written by Claude (starter code), not by me, so the 5 of 5 is not a quality measure.
- I did not test why Q4 was close, for example by rewording the question or the text.
- No other embedding model was compared, no chunking, no vector database (Day 23), and no LLM answer step.
- The time to embed 10 texts is about 50 ms on my Mac. I did not measure it for a larger set.

## Link

- TODO: docs link (model card or transformers.js docs) and one sentence from it
