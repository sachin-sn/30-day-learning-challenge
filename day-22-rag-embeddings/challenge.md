# Day 22 — RAG Basics: Embed, Search, Check by Hand

**Time box:** 90 minutes. Part A about 40 min, Part B about 30 min, notes about 15 min.
If a part runs over by 15 minutes, stop, write down where you stopped, and move on.
**Tech stack:** Node.js 22, `@huggingface/transformers` (runs the embedding model on your Mac,
no API key, no cost), JavaScript with ES modules

## Why this matters

RAG (retrieval-augmented generation) is: find the few texts that match a question, then give
them to the LLM. The finding step is embeddings plus a similarity score. You have built RAG
features at work, so today you look at the retrieval step on its own, on 10 texts you can
read, and check by hand where it works and where it does not. That check is the part
interviewers ask about ("how do you know your retrieval is good?").

## Predictions (write these first, 5 min)

Put them in `solution.md` before you run any code.

1. How many numbers (dimensions) will one embedding vector have? (A number; a guess is fine.)
2. You ask 5 questions. For how many of the 5 will the right text be in the top 3 results?

## Part A — Build it (about 40 min)

The starter code is ready in `src/`. Your job is to read it and understand every line, then run it.
You should be able to explain `cosine()` in one sentence in an interview.

1. In `src/`: `npm install` (the `package.json` is there).
2. `node search.js "how do I keep a token from being edited"` — the first run downloads the
   model (it needs internet access to huggingface.co). It embeds the 10 texts in `docs.json`,
   writes `vectors.json` (Day 23 reuses this file), and prints the top 3 for your question.
3. Try two or three questions of your own. Look at the scores, not only the order.

Done looks like: `vectors.json` exists, you know the vector size, and you have seen top-3
results for your own questions.

## Part B — Check it by hand (about 30 min)

1. `node eval.js` asks the 5 questions in `questions.json` and prints the top 3 texts with scores.
2. For each question, read the top 3 yourself and decide: is the right text there? The script
   also prints the text it expects, but your reading is the result. If you disagree with the
   script, write down why.
3. Pick one miss, or the weakest hit, and write the reason you think it happened.
   (If there is no miss, pick the question with the lowest top score and say what you see.)

## Save this output

- The vector size, the time to load the model, and the time to embed the 10 texts
- The top-3 hit count out of 5 (by your reading)
- One miss or weak hit: the question, the top 3 with scores, and your reason (marked as a guess
  if you did not test it)

## Not part of today

Chunking long documents, a vector database (that is Day 23), re-ranking, and the LLM answer step.
If you finish early, add your own 5 questions to `questions.json`, but do not tune the texts until
the first run is saved.

## Resources

- https://huggingface.co/Xenova/all-MiniLM-L6-v2
- https://huggingface.co/docs/transformers.js
