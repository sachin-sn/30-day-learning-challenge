---
title: "Day 26 — Ten Test Cases, 10/10 Every Time, and Why That Tells Me Little"
date: "2026-10-17"
excerpt: "I scored a classification prompt on ten test cases, changed the prompt, and ran everything again on two models. Every run was 10 out of 10, so the test could not tell any of them apart."
tags: ["30-day-challenge", "day-26", "prompt-engineering", "evals", "claude-api", "nodejs"]
draft: true
---

Day 25 looked at the loop inside an agent. Day 26 is about how you know a prompt
is good: ten test cases with the right answers, and a script that scores the
prompt against them. It is the short 90-minute format again.

## The setup

The starter code came with the challenge, written by Claude. It has a
`cases.json` with ten customer support messages, each with an expected label
(`billing`, `bug`, `feature_request` or `other`). Claude also wrote those labels. Then
there is `prompts.js` with two versions of the prompt, and `eval.js`, which sends
each message to the model and scores the answer by exact match. Prompt v1 is two
lines: the four category names and "answer with the category name only". Prompt v2 is v1 plus a
short definition of each category.

I wrote two predictions before running anything. For the score of v1 I did not
give a number. I wrote that it might be used as a benchmark, so that was not a
real prediction. For two runs of the same prompt I said the scores would differ
by 2 points or more.

## What happened

```
model             prompt   runs   scores
claude-haiku-5-5  v1       5      10, 10, 10, 10, 10
claude-haiku-5-5  v2       2      10, 10
claude-opus-5-5   v1       2      10, 10
claude-opus-5-5   v2       2      10, 10
```

Every run scored 10 out of 10. No case changed its answer between runs. The
difference between two runs of the same prompt was 0 points, so my guess of 2 or
more was wrong. The difference between v1 and v2 was 0, and the difference between
the two models was 0. The v1 runs on Haiku were three separate commands and one
command with two runs, which is why there are five.

## What this does and does not show

A score of 10 out of 10 sounds good, but it mostly says that my cases were easy.
v1 already got everything right, so there was nothing left for v2 to improve, and
v2 could only tie or get worse. A test that every version passes cannot tell the
versions apart. That is the real result of today: the eval script works, and the
ten cases were not hard enough to use it.

I also did not test any of this. With ten cases and two to five runs I cannot say
the model never varies, only that it did not vary here. I used two models with
default settings and one exact-match scoring. I did not measure the time or the cost per
run, I did not try messages that fit two labels, and I did not look at what
happens with longer or messier messages. The extra run on a second model came
after the main exercise, and I did not write a prediction for it.

## What's next

Day 27 is local LLMs with Ollama. I will run these same ten cases on a model on my
own machine and compare the score and the time. If it also scores 10/10, I will
need harder cases first. Full code in the [repo](#) — `day-26-prompt-evals/`.
