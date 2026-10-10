# Day 19 — Solution: CI/CD Matrix Builds and a Canary Check

> Status: done. A few details from the GitHub run page are still marked TODO.

## Predictions (written before the work)

1. In a matrix with two Node versions, one version's job fails. With the default settings, what happens to the job of the other version? **It will still run in the other Node version.**
2. A canary script sends each of 100 requests to "v2" with a 10% chance. Run it 3 times. How many requests go to v2 in each run? **20 to 40 requests.**

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

Added `fail-fast: false` under `strategy:` in `.github/workflows/day-19.yml`.

Result: the Node 22 job passed and the Node 24 job failed (the same test as before). So with `fail-fast: false` the Node 22 job finished with its own result, where before it was cancelled. TODO: the job durations from the run page.

### Part B, step 3: canary

`for i in 1 2 3 4 5; do node src/canary.js; echo ---; done` (v1 fails 1%, v2 fails 5%, 10% of 100 requests go to v2, roll back if v2 is more than 2 percentage points above v1):

```
run 1  v1: requests=87 failures=3 error rate=3.4%   v2: requests=13 failures=0 error rate=0.0%    PROMOTE
run 2  v1: requests=87 failures=2 error rate=2.3%   v2: requests=13 failures=2 error rate=15.4%   ROLLBACK
run 3  v1: requests=86 failures=1 error rate=1.2%   v2: requests=14 failures=2 error rate=14.3%   ROLLBACK
run 4  v1: requests=85 failures=1 error rate=1.2%   v2: requests=15 failures=0 error rate=0.0%    PROMOTE
run 5  v1: requests=94 failures=1 error rate=1.1%   v2: requests=6  failures=0 error rate=0.0%    PROMOTE
```

- v2 requests per run: 13, 13, 14, 15, 6. My prediction was 20 to 40. Wrong: none of the 5 runs was in that range. With a 10% chance on 100 requests, the expected count is 10, and the runs stayed around that.
- 2 of 5 runs said `ROLLBACK`, 3 said `PROMOTE`. The failure rates were the same in every run (v2 really fails 5%, v1 1%), yet the decision changed.
- The reason is in the numbers: with 6 to 15 requests on v2, one failure moves its error rate by 7 to 17 points (run 2: 2 failures in 13 is 15.4%). In run 1, v1 even had a higher rate than v2 (3.4% against 0.0%).

## What I learned (3 sentences at most, drafts from the output above; edit them)

- A matrix job that fails cancels the others by default (`fail-fast: true`). Setting `fail-fast: false` lets every version report its own result, which is what you want to see when only one Node version is broken.
- A 10% canary of 100 requests puts only about 6 to 15 requests on v2, so one failure can flip the decision. The rule needs enough requests (or a time window) before the percentage means anything.
- My local Node (v22.2.0) and the CI Node 22 behaved differently on module detection, so the same code can pass on one machine and fail on another.

## Not measured / still open

- The sample is 5 canary runs and one run of each workflow version. I did not compute how many requests a canary needs before the decision is reliable.
- I did not run the matrix with `fail-fast: true` more than once, so I do not know if the Node 22 job is always cancelled or only when it is still running when the other job fails.
- Job names and durations from the run pages, the date I checked the Node release page, and the docs sentence about `fail-fast` are still TODO (above).

## Link

- https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/running-variations-of-jobs-in-a-workflow
