# Day 19 — CI/CD: Matrix Builds and a Canary Check

**Time box:** 90 minutes. Part A about 40 min, Part B about 30 min, notes about 15 min.
If a part runs over by 15 minutes, stop, write down where you stopped, and move on.
**Tech stack:** GitHub Actions, Node.js (built-in test runner `node --test`), a small Node script

## Why this matters

"How do you test on more than one Node version?" and "how would you release to 10%
of users first?" are common interview questions. A matrix build answers the first.
A canary answers the second, and the interesting part is not the 10%: it is how
you decide, from the numbers, to continue or to roll back.

## Predictions (write these first, 5 min)

Put them in `solution.md` before you start.

1. In a matrix with two Node versions, one version's job fails. With the default
   settings, what happens to the job of the other version: does it finish, or does it
   stop? (Say what you expect to see on the run page.)
2. A canary script sends each of 100 requests to "v2" with a 10% chance. Run it 3
   times. How many requests go to v2 in each run? Give a range, not one number.

## Part A — Build it (about 40 min)

1. In `src/`, make a tiny module (for example `add.js` with an `add(a, b)` function)
   and one test file with `node:test` and `node:assert`. Done looks like
   `node --test` passing on your machine.
2. Add the workflow file **at the repo root**, not in the day folder:
   `.github/workflows/day-19.yml`. GitHub only reads workflows from that folder.
   - Trigger: `workflow_dispatch` (manual) and `push` limited to the paths of this
     day's folder (`paths:`), so the other days do not start it.
   - One job `test` with a **matrix** of two Node versions that are currently
     supported (check https://nodejs.org/en/about/previous-releases and write the
     date you checked).
   - Steps: `actions/checkout`, `actions/setup-node` with the matrix version, then
     `node --test`. Set `defaults.run.working-directory` to this day's `src/`.
3. Push and open the run on GitHub (Actions tab). Done looks like two green jobs, one
   per Node version.

## Part B — Measure or break it (about 30 min)

1. **Break one version.** Add a test that passes on one of your versions and fails on
   the other (for example `assert.ok(process.version.startsWith("v22"))`). Push.
   Look at the run page and compare it with your prediction 1.
2. **Change `fail-fast`.** Add `strategy.fail-fast: false`, push again, and compare
   the run page with the first one.
3. **Canary script.** Write `src/canary.js`. It sends 100 simulated requests. Each goes
   to "v2" with a 10% chance, else to "v1". Make v1 fail 1% of the time and v2 fail 5%
   of the time. At the end it prints, for each version, the number of requests, the
   number of failures and the error rate, and prints `PROMOTE` or `ROLLBACK` (roll back
   if the v2 error rate is more than 2 percentage points above the v1 error rate).
   Run it 5 times.

## Save this output

- The run page for the first failing run and for the `fail-fast: false` run: the status
  and the duration of each job (copy the text from the page, or a screenshot)
- The output of the 5 canary runs
- How many of the 5 canary runs said `ROLLBACK`, and how many v2 requests each run had

## Not part of today

Deploying anywhere, secrets, caching, reusable workflows, a real traffic split in a
load balancer, Argo Rollouts and similar tools. They are good next steps.

## Resources

- https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/running-variations-of-jobs-in-a-workflow
- https://nodejs.org/api/test.html
