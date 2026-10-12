---
title: "Day 21 — The API Would Not Let Me Set the Temperature"
date: "2026-10-12"
excerpt: "I streamed an answer from the Claude API and timed it six times. The plan was to compare temperature 0 and 1, but the API refused the setting on every model I tried. The first text token came after 1.1 to 1.9 seconds, and every response had a thinking block I never asked for."
tags: ["30-day-challenge", "day-21", "llm", "claude-api", "streaming", "nodejs"]
draft: true
---

Day 20 was about deciding whether a request should be let in. Day 21 is the first
day where the code calls an LLM: a streamed request to the Claude API from Node,
then timing it. It is the short 90-minute format again. The plan had a second
part that compared temperature 0 and temperature 1. That part did not work, and
this post says why.

## Before the first answer

I wrote two predictions before any code. The time: "~3-5 seconds", one range
that did not say if I meant the first token or the whole answer. And the
temperature: at 0 at least 2 of 3 answers would be the same, and at 1 all 3 would
be different.

Then two errors, in this order.

The first was about money, not code: `Your credit balance is too low to access
the Anthropic API`. The key worked and the request reached the API. A claude.ai
subscription does not include API credit, and I had to add some in the Console
before anything ran.

The second came when I passed `temperature: 0`:

```
invalid_request_error: `temperature` is deprecated for this model.
```

I tried the Haiku, Sonnet and Opus models from my list and got the same error
each time. So I took `temperature` out and measured with the default settings.
I did not check if any model accepts it, or what the default is.

## The streaming call

The call is short: a `system` prompt, one user message, and
`client.messages.stream(...)`. The loop prints each `text_delta` as it arrives,
and `finalMessage()` gives the token counts at the end.

My first working runs used a prompt of my own ("Anthropic", 100 words), so they
do not match the prompt I made predictions for. Seven runs gave seven different
texts, with output tokens between 339 and 420. Some answers started with
`**Anthropic**`, some with `# Anthropic`, and one had two paragraphs.

## Six timed runs

For the timed runs I used the prompt from the plan ("Explain in about 150 words
what a JWT is.") and `claude-opus-5-5`. A timer started before each call. The
first text piece stopped one clock and the end of the stream stopped the other.

```
run  first_token_ms  total_ms  in_tok  out_tok  words
1    1427            4585      35      368      150
2    1204            4100      35      363      148
3    1136            3946      35      360      152
4    1871            4746      35      361      153
5    1683            4444      35      345      156
6    1160            4229      35      356      150
```

The first text piece took 1.1 to 1.9 seconds (mean 1414 ms) and the full answer
3.9 to 4.7 seconds (mean 4342 ms). My "3-5 seconds" fits the total. For the first
token it was wrong. Since I did not say which one I meant, I wrote down both.

All 6 answers were different texts, and they were 148 to 156 words long. They
differed already in the first sentence: run 1 says "between parties", run 2 says
"between two parties". So at the default setting, the same prompt did not
give the same answer. I do not know what that default is, so I cannot say this is
what temperature 1 would do.

## The thinking block I did not ask for

Every one of the six responses had two content blocks: `thinking`, then `text`.
I had not turned thinking on. So my "time to first token" is really the time to
the first text piece, and it comes after whatever thinking happened. I did not
measure the time to the first event of any kind.

It may also explain the token counts. 150 words is fewer than the 345 to 368
output tokens I saw, and thinking tokens probably make up the gap. That is a
guess, because I did not split the count.

## What I'm leaving open

Temperature 0 against 1, which is the part I wanted. Which model, if any, accepts
the setting. How many of the output tokens are thinking tokens. Only one model for
the timed runs, six runs, and one prompt. No comparison with a non-streaming call
and no cost calculation. I did not read the streaming docs, so I am not quoting
them.

## What's next

Day 22 is RAG with embeddings. I do not know yet which embeddings option I will
use, and that has to be settled first. Full code in the [repo](#) —
`day-21-llm-api-basics/`.
