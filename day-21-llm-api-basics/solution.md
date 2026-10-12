# Day 21 — Solution: LLM API Basics

> Status: done, with one change: the temperature 0 against 1 comparison could not be run (see below). Docs link still TODO.

## Predictions (written before the work)

Prompt for all runs: a 150-word explanation of what a JWT is.

1. How many milliseconds until the first token arrives, and how many seconds for the whole answer?
   Prediction: "~3-5 seconds" (one range; it does not say if this is the first token or the whole answer) — result: as total time it fits: 3946 to 4746 ms over 6 runs (mean 4342 ms). As time to first token it was wrong: 1136 to 1871 ms (mean 1414 ms).
2. Three runs at temperature 0: how many of the 3 answers will be exactly the same text? And at temperature 1?
   Prediction: temperature 0: "at least 2 answer should be same"; temperature 1: "all the 3 answer will be unique" — result: could not be tested, the API refused `temperature` on every model I tried. At the default setting 6 of 6 answers were unique (I do not know the default temperature).

## Output

### Temperature error (real output)

Model: `claude-haiku-5-5`, request with `temperature: 0`.

```
invalid_request_error: `temperature` is deprecated for this model.
request_id: req_011CfxQZVYdbWBYjo682k3NS
```

So the temperature 0 against temperature 1 comparison could not be run on this model.

### Part A

First working runs (`stream.js`, no `temperature`, system prompt via `system`, no timing yet).
Prompt: system "You are a concise technical writer, generate a simple 100 word context on the topic:", user "Anthropic".
This is not the JWT prompt my predictions were written for. Model: `claude-opus-5-5` in the file when I pasted
(TODO: confirm all 7 runs used it).

```
run  input_tokens  output_tokens
1    39            339
2    39            420
3    39            355
4    39            358
5    39            361
6    39            374
7    39            396
```

The 7 answers were all different texts. Some started with `**Anthropic**`, some with `# Anthropic`, and one had two paragraphs.
The answers look like about 100 words each, but output_tokens is 339 to 420. I do not know why (not checked).

### Part B (`bench.js`, no `temperature`)

Prompt: system "You are a concise technical writer.", user "Explain in about 150 words what a JWT is."

```
model: claude-opus-5-5
run  first_token_ms  total_ms  in_tok  out_tok  words  blocks  hash
1    1427            4585      35      368      150    thinking,text 3b4a9b4c
2    1204            4100      35      363      148    thinking,text 3d741132
3    1136            3946      35      360      152    thinking,text c54403f6
4    1871            4746      35      361      153    thinking,text c91f0c2f
5    1683            4444      35      345      156    thinking,text e76d0a8d
6    1160            4229      35      356      150    thinking,text 015aa5fb

unique answers: 6 of 6
run 1 starts: "A **JSON Web Token (JWT)** is a compact, URL-safe format for securely transmitting claims between parties. It is commonly used for authentication and authorizat"
run 2 starts: "A **JSON Web Token (JWT)** is a compact, URL-safe format for securely transmitting claims between two parties, commonly used for authentication and authorizatio"
```

Every response had a `thinking` block before the `text` block, although I did not turn thinking on.
`first_token_ms` is the time to the first text piece, so it comes after that thinking.

## What I learned (3 sentences at most)

`claude-opus-5-5` refused the `temperature` setting, and so did the Haiku and Sonnet models I tried, so I measured with the default setting. The first text token came after 1.1 to 1.9 seconds and the whole answer after 3.9 to 4.7 seconds, and every response had a thinking block before the text. All 6 answers to the same prompt were different texts, with 148 to 156 words each.

## Not measured / still open

- Temperature 0 against 1: not run, the API refused `temperature`. I did not check if any model accepts it, or what the default is.
- I did not measure how many of the ~360 output tokens are thinking tokens, so I cannot say how much they explain the high token counts. My guess is that most of the gap to 150 words is thinking (not checked).
- I did not measure time to the first event of any kind (including the thinking block), only to the first text piece.
- Only one model for the timed runs, 6 runs, one prompt. No streaming against non-streaming comparison, no cost calculation.

## Link

Reference link: https://platform.claude.com/docs/en/build-with-claude/streaming#streaming-with-sdks
