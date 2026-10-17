# Day 26 — Prompt Evals: Ten Cases, a Score, and One Change

**Time box:** 90 minutes. Part A about 40 min, Part B about 30 min, notes about 15 min.
If a part runs over by 15 minutes, stop, write down where you stopped, and move on.
**Tech stack:** Node.js 22, `@anthropic-ai/sdk`, JavaScript with ES modules (uses your API credit; today costs a few cents)

## Why this matters

"How do you know a prompt change made things better?" is a standard question for anyone who ships LLM features. The
answer is an eval: fixed test cases with known answers and a score. Today you build the smallest possible one, change
the prompt once, and look at what moves the score: the prompt change, or just the model's run-to-run variation.

## Predictions (write these first, 5 min)

Put them in `solution.md` before you run any code. Read `src/cases.json` and `src/prompts.js` (version v1) first.

1. What score will prompt v1 get on the 10 cases (a number out of 10)?
2. You run the same prompt twice. By how many points will the two scores differ (0, 1, 2 or more)?

## Part A — Build it (about 40 min)

The starter code is ready in `src/`: `cases.json` (10 support messages with the label I think is right), `prompts.js`
(two prompt versions) and `eval.js` (sends each case to the model and counts exact matches).

1. In `src/`: `npm install`. Make sure `ANTHROPIC_API_KEY` is set in your shell (never in a file).
2. Read `cases.json`. These are my labels, not yours. For each of the 10, say if you agree. Note any you do not
   agree with in `solution.md`; do not change the file until the first runs are saved.
3. Read `eval.js`: where the prompt goes (the `system` field), how a case is scored (exact match after lower-casing),
   and what counts as "not a label".
4. `node eval.js v1` runs prompt v1 once and prints every case. If the model name is rejected, change `MODEL`.

Done looks like: a score for v1 out of 10, and a list of which cases were wrong and what the model answered.

## Part B — Change it, run it twice (about 30 min)

1. Read `v2` in `prompts.js`. It adds definitions and one rule. You may change it before you run it; if you do, write
   down exactly what you changed.
2. `node eval.js v2 2` runs v2 twice and prints both scores and the cases whose answer changed between the two runs.
3. `node eval.js v1 2` runs v1 twice for the same comparison.

## Save this output

- The score for v1 (and for each of its runs) and for v2 (each run)
- Which cases were wrong in each version, and what the model answered
- The difference between the two runs of the same prompt, and which cases changed between runs
- Any labels in `cases.json` you disagree with

## Not part of today

LLM-as-judge scoring, more than 10 cases, tuning the prompt until it scores 10/10, and eval frameworks. Do not edit the
test cases to make a score better.

## Resources

- https://docs.anthropic.com/en/docs/test-and-evaluate/develop-tests
