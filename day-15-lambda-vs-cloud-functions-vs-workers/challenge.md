# Day 15 — Lambda vs Cloud Functions vs Workers

**Difficulty:** Intermediate
**Tech stack:** TypeScript (Node 20+), AWS Lambda (Function URL), Google Cloud Functions 2nd gen (now called Cloud Run functions), Cloudflare Workers (Wrangler)
**Estimated time:** 3-4 hours

## Why this matters

Yesterday you described servers as code. Today you remove the servers from
the picture: you hand a platform one small function, and it decides where
and when that function runs. All three platforms sell the same idea. The
differences are in the details, and the details decide which one fits.
How is a request given to your code? What happens on the first request
after a quiet period? How long can one request run? What do you pay for?

You will write one small function and run it on all three. The function has
no business logic that matters. That is on purpose: when the code is
identical, every difference you see comes from the platform.

## Learning objectives

By the end of today you should be able to:

- Describe the programming model of each platform: what object your code
  receives, what it must return, and where your code starts running
- Keep the business logic in one platform-free module, and write a thin
  adapter for each platform
- Measure a cold start and a warm start with your own numbers, and say
  what causes the difference on each platform
- Find the limits that matter (run time, memory, request size, CPU) and the
  pricing model of each platform in the official documentation
- Work out the cost of three workloads on each platform, and say which one
  you would choose for each workload and why
- Delete everything you deployed and confirm that nothing is left that can
  bill you

## The challenge

Put all code in `src/`. Write down results as you go. The numbers you
measure are the evidence, the same way the plan output was on Day 14.

**Part 1 — one core, three adapters.** Write `src/core.ts`. It exports one
plain function that does not import anything from any platform:

```ts
type Req = { method: string; path: string; query: Record<string, string>; body: string };
type Res = { status: number; headers: Record<string, string>; body: string };
export function handle(req: Req): Res;
```

It must do three things:

- `GET /hash?input=abc` returns the SHA-256 of the input as JSON
- `GET /info` returns JSON with `instanceId` (a random ID created once,
  when the module loads), `requestCount` (how many requests this instance
  has served), and `initMs` (how long the module took to load)
- Any other path returns 404

`instanceId`, `requestCount` and `initMs` must be created **outside** the
handler, at module level. This is how you will see cold and warm starts in
Part 4. Use only Web-standard APIs if you can (for example
`crypto.subtle`), because Workers does not run full Node.js. If you use a
Node-only API, note it and see what happens on Workers in Part 2.

Then write three small adapters. Each one only converts the platform's
request into `Req`, calls `handle`, and converts `Res` back:

- `src/aws/index.ts`: a Lambda handler for a Function URL (payload format
  2.0)
- `src/gcp/index.ts`: an HTTP function that uses `@google-cloud/functions-framework`
- `src/cloudflare/index.ts`: a Worker with `export default { fetch }`

Before you write them, write down the shape of the request object on each
platform, from memory. Then check in the documentation and correct
yourself.

**Part 2 — run it locally, compare the shapes.** Run each adapter on your
Mac with no cloud account:

- AWS: write a small script that calls your handler with a fake Function
  URL event. (Bonus: `sam local`.)
- GCP: `npx functions-framework --target=<name>` and use `curl`
- Cloudflare: `npx wrangler dev` and use `curl`

Call `/hash?input=abc` and `/info` on each. Check that all three return the
same SHA-256. Call `/info` five times and watch `requestCount` and
`instanceId`. In `solution.md`, put the three request shapes in a table:
how each platform gives you the method, the path, the query, the headers and
the body, and how each one wants the answer returned. Note anything that
broke or behaved differently, for example a Node API that is missing on
Workers.

**Part 3 — deploy.** Deploy the adapter to each platform that you can,
using the free tier. Do all three if you can. Do at least two. Before you
deploy, set a **budget alert** on the AWS and GCP accounts. After you
deploy, call `/hash?input=abc` on the public URL and check the answer. Write
down: how many commands or clicks it took, how long the deploy took, what
the URL looks like, and which setup step was the most confusing.

Every URL is public. The function you wrote has no secrets and does little
work, so this is acceptable, but do not leave any of them running after
today (see Constraints).

**Part 4 — cold start vs warm start.** Write `src/bench.ts`. It takes a URL
and does two things: it sends one request and records the time and the
`/info` result, and then it sends 30 requests one after another and records
the time of each. Print the first time, then the median and the 95th
percentile of the other 30.

Write your predictions first, for each platform: is the first request slower
than the rest? By how much? Is `instanceId` the same on all 30 requests?
Then run the script against each deployed URL **after the function has been
idle for a while** (at least 15 minutes; do something else meanwhile). Run it
a second time right away. Record, for each platform:

- the time of the first request, and the median of the rest
- whether `instanceId` changed, and what `initMs` was
- anything you did not predict

Your timing includes your own network distance to the platform. Say what the
`/info` fields can and cannot tell you, and what a better test would look
like.

**Part 5 — limits and pricing.** Find these facts in the **official**
documentation for each platform. Do not use a blog post, and do not copy a
number from this file or from memory. Put the link and the date you read it
next to every number, because these numbers change:

- the longest time one request may run
- the memory you can choose
- the largest request and response body
- how CPU is given to the function (for example, is it tied to memory?)
- how much is free each month, and what you pay after that, including how
  the bill is measured (requests, run time, memory, or CPU time)

Then work out the monthly cost for three workloads on each platform, and show
the arithmetic:

1. 1 million requests a month, 50 ms each, small memory
2. 100 million requests a month, 50 ms each, small memory
3. A job that needs 4 minutes of run time, 20 times a day

For each workload, say which platform you would choose, or whether you would
use none of them. A virtual machine or a container service may be a better
answer for a workload.

**Part 6 — put it together in solution.md.** Write up what you observed: the
request-shape table, the deploy notes, the cold-start numbers, the limits
table with links and dates, the cost arithmetic, and your own decision table:
for which kind of work would you pick each platform, and for which kind of
work would you pick none of them. Finish with the clean-up check (see below).

### Requirements

- One `core.ts` with no platform imports, and three adapters that are each
  short
- The same SHA-256 from all three platforms for the same input
- Predictions written before Parts 1, 2 and 4, with whether each held
- A cold-start measurement for each platform that you deployed to
- A limits and pricing table with a link and a date next to every number
- Three cost calculations with the arithmetic shown
- `solution.md` written from real output

### Constraints

- Free tier only. Set a budget alert on the AWS and GCP accounts **before**
  you deploy anything
- Never put an access key, a token or a password in a file in this repo. Use
  the CLI login of each platform. Add `.env`, `.dev.vars`, `.wrangler/`,
  `.aws-sam/` and `node_modules/` to `.gitignore` before the first deploy
- Do not read numbers for limits or prices from memory or from this file.
  Read them from the official documentation on the day, and write the date
- Delete everything you deployed when you finish, and prove it: list the
  functions, roles and logs on each platform and show that nothing is left
  (see the clean-up check)
- Do not use a framework such as Serverless Framework, SST or Hono for the
  core challenge. You want to see each platform's own model

### Clean-up check

At the end, run the list commands for each platform and put the output in
`solution.md`: for example `aws lambda list-functions`,
`gcloud functions list`, and `wrangler deployments list` or the Workers page
in the dashboard. Also check the IAM roles and the log groups that the
deploy made. A function that you deleted can leave these behind.

## Bonus round (optional)

- Add a fourth target: Vercel or Netlify functions, Deno Deploy, or Azure
  Functions. What did you have to change in the adapter, and what did you
  not have to change?
- Make `/hash` do real CPU work (for example, 200,000 rounds of hashing) and
  repeat Part 4. Which platform slows down, and what does the documentation
  say about why?
- Put `/info` behind a counter in a database (Day 4's Redis, Day 5's
  DynamoDB, or Cloudflare KV) and show that `requestCount` in memory is not
  a global count. Which platforms give two instances at the same time?
- Send 50 requests at the same time and count the distinct `instanceId`
  values on each platform. What does this tell you about how each one scales?
- Measure a cold start with a large dependency added to the bundle, and show
  how bundle size changes the time of the first request
- One paragraph: which of your earlier days would be hard to run inside a
  function, and why? Think about WebSockets (Day 10), gRPC (Day 11) and
  locks (Day 13).

## Resources

- https://docs.aws.amazon.com/lambda/latest/dg/urls-configuration.html
- https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html
- https://cloud.google.com/functions/docs/concepts/overview
- https://github.com/GoogleCloudPlatform/functions-framework-nodejs
- https://developers.cloudflare.com/workers/get-started/guide/
- https://developers.cloudflare.com/workers/reference/how-workers-works/
- https://developers.cloudflare.com/workers/platform/limits/

---

Once you've built something, write up `solution.md` in this folder using
`../_template/solution.md` as a starting point.
