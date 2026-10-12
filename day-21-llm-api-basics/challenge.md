# Day 21 — LLM API Basics: Stream, Time, Compare

**Time box:** 90 minutes. Part A about 40 min, Part B about 30 min, notes about 15 min.
If a part runs over by 15 minutes, stop, write down where you stopped, and move on.
**Tech stack:** Node.js 22, the Anthropic SDK (`@anthropic-ai/sdk`), JavaScript with ES modules

## Why this matters

Every AI feature (RAG, agents, evals) starts with one API call. Interviews ask about
streaming, tokens, cost, latency and temperature. Today you make the call, stream the
answer, and measure two numbers you can quote: time to first token and total time.

You need an API key from the Anthropic Console (console.anthropic.com). It is separate
from a claude.ai subscription and needs a few dollars of credit. Today costs a few
cents. If you do not have a key, tell me before starting and we pick another option.

## Predictions (write these first, 5 min)

Put them in `solution.md` before you write code. Use the same prompt for all runs: ask for a
150-word explanation of what a JWT is.

1. How many milliseconds until the first token arrives (time to first token)? And how many
   seconds for the whole answer?
2. You run the prompt 3 times at temperature 0. How many of the 3 answers will be exactly
   the same text? And at temperature 1?

## Part A — Build it (about 40 min)

In `src/` (set `"type": "module"` in `package.json`), install `@anthropic-ai/sdk`.

1. Put the key in your shell, **never in a file**: `export ANTHROPIC_API_KEY=...`
   (the SDK reads it by itself). Make sure `.env` files are in `.gitignore`.
2. Write `stream.js`: call the Messages API with a **system prompt** (for example "You
   are a concise technical writer") and a user prompt, **streaming** the answer. Print the
   text as it arrives.
3. Choose the model name from the docs or the Console, and keep it in one constant at the
   top. Set `max_tokens` (for example 300).
4. When the stream ends, print `input_tokens` and `output_tokens` from the final message.

Done looks like: the answer prints in pieces on your screen, followed by the two token
counts.

## Part B — Measure it (about 30 min)

Change `stream.js` so that it takes the temperature as an argument and measures time with
`performance.now()`:

- **time to first token:** from just before the call to the first text piece
- **total time:** from just before the call to the end of the stream

Run the same prompt **3 times at temperature 0 and 3 times at temperature 1**. For each run
print: temperature, time to first token (ms), total time (ms), input tokens, output tokens.
Then compare the 3 answers of each setting: identical or not?

If the API refuses the `temperature` setting for your model, write down the exact error and
stop Part B there. That is a result too.

## Save this output

- A table of the 6 runs: temperature, time to first token, total time, input tokens, output tokens
- For each temperature: how many of the 3 answers were identical (compare the text, for
  example with a hash or `===`)
- One short example of how two answers at temperature 1 differed

## Not part of today

Tool calling, caching, batch API, vision, and prompt tuning. Cost calculations from the
price page are fine, but write the date you read the price.

## Resources

- https://docs.anthropic.com/en/api/messages-streaming
- https://docs.anthropic.com/en/docs/about-claude/models
