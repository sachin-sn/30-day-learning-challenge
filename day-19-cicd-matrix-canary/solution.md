# Day 19 — Solution: CI/CD Matrix Builds and a Canary Check

> Status: in progress. Predictions written. Part A and Part B not recorded yet.

## Predictions (written before the work)

1. In a matrix with two Node versions, one version's job fails. With the default settings, what happens to the job of the other version? **It will still run in the other Node version.**
2. A canary script sends each of 100 requests to "v2" with a 10% chance. Run it 3 times. How many requests go to v2 in each run? **20 to 40 requests.**

Results: TODO (after the runs).

## Output

### Part B, step 1: one version fails on purpose (default `fail-fast`)

`src/version.test.mjs` asserts `process.version.startsWith("v22")`. It passes on Node 22 and fails on any other version.

Node 24 job, from the run log:

```
test at src/version.test.mjs:4:1
✖ runs on Node 22 (1.176784ms)
  AssertionError [ERR_ASSERTION]: v24.21.0
      at TestContext.<anonymous> (file:///home/runner/work/30-day-learning-challenge/30-day-learning-challenge/day-19-cicd-matrix-canary/src/version.test.mjs:5:10)
  code: 'ERR_ASSERTION', actual: false, expected: true
```

Node 22 job, from the run log: `Error: The operation was canceled.`

- Prediction 1 (the other job still runs): not what I saw. The Node 22 job ended with "The operation was canceled." It did not report its own test result, although the same test would pass on Node 22 (the file asserts exactly that).
- That fits the default of `strategy.fail-fast`, which is `true`: when one matrix job fails, GitHub cancels the jobs that are still running. This explanation is from my reading of the GitHub docs page in "Link"; I did not check the page text for this write-up. TODO: write the exact sentence and the date.
- I only have the log text, not the run page. TODO: the status label and the duration of each job from the run page.

### Part A: the first run (before the broken test)

The matrix jobs passed. TODO: job names and durations from the run page (I wrote `22.x` and `24.x` in the workflow file; my notes said 20 and 22 at one point, so write down which versions the page shows). TODO: the date I checked the Node release page.

### Part B, step 2: `fail-fast: false`

Added `fail-fast: false` under `strategy:` in `.github/workflows/day-19.yml`. Result: TODO (after the push).

### Part B, step 3: canary

TODO (5 runs of `node src/canary.js`).

## What I learned (3 sentences at most)

TODO

## Not measured / still open

TODO

## Link

- https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/running-variations-of-jobs-in-a-workflow
