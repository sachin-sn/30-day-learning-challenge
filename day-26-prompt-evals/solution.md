# Day 26 — Prompt Engineering & Evals

## Predictions (written before running anything)

1. Score of prompt v1 on the 10 cases (out of 10): "none, as it might be used as bench marks" (no number given)
2. Difference in points between two runs of the same prompt: 2 or more

## Output

### Part A: `node eval.js v1` (model claude-haiku-5-5, default settings)

I ran it 3 times, each as a separate command with 1 run. Each time: score 10 / 10, all 10 answers matched the expected label exactly (billing, bug, feature_request, other as in `cases.json`). Scores: 10, 10, 10.

### Part B

Prompt v2 as in `prompts.js` (TODO: if I changed it, write what I changed here).

| prompt | run 1 | run 2 | cases that changed between runs |
|--------|-------|-------|---------------------------------|
| v2     | 10/10 | 10/10 | none                            |
| v1     | 10/10 | 10/10 | none                            |

Across all runs: v1 ran 5 times in total (3 single runs in Part A, 2 in Part B), v2 ran 2 times. Every run was 10/10, with no wrong answer. Difference between the two runs of the same prompt: 0 points for v1 and 0 for v2. Difference between prompts: 0 points. Cases whose labels I disagree with: TODO (none noted yet).

### Extra: same cases on another model (claude-opus-5-5)

No prediction was written for this extra run. I changed `MODEL` in `eval.js` to `claude-opus-5-5` and ran `node eval.js v2 2` and `node eval.js v1 2`.

| model | prompt | run 1 | run 2 | cases that changed between runs |
|-------|--------|-------|-------|---------------------------------|
| claude-opus-5-5 | v2 | 10/10 | 10/10 | none |
| claude-opus-5-5 | v1 | 10/10 | 10/10 | none |

Same result as claude-haiku-5-5: every run 10/10, no wrong answer, no difference between prompts or between runs. The two models also cannot be told apart on these 10 cases. Time and cost per run: not measured.

## What I learned (3 sentences)

TODO

## Not measured / still open

- The 10 cases (written by Claude) were too easy for this model: v1 already scored 10/10, so these cases cannot show whether v2 is better. Not tested with harder or ambiguous cases.
- Only 10 cases and 2 to 3 runs per prompt, so "no variation" may not hold with more runs.
- Two models (claude-haiku-5-5 and claude-opus-5-5), default settings. Not tried: other models, other prompts, a case with more than one correct label.
- Time and cost per run: not measured.

## Link

TODO: docs link with one sentence
