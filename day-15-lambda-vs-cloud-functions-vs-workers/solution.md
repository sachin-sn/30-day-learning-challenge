# Day 15 — Solution: Lambda vs Cloud Functions vs Workers

**Blog post:** <link, once published>
**LinkedIn post:** <link, once shared>

> Status: code, local runs on all three platforms, the Cloudflare deploy and
> benchmark, the AWS and GCP deploys and benchmarks, and the limits/pricing/cost work
> are done. The remaining `TODO` lines are yours: your own words on the
> confusing step, your decision table, the "do differently" section, and the
> clean-up check (`npx wrangler delete`, then show nothing is left). Nothing in
> a `TODO` section has been invented.

## Setup

```
cd src
npm install
npm run local:aws        # calls the Lambda handler with a fake Function URL event
npm run local:gcp        # functions-framework on :8081, then: curl "localhost:8081/hash?input=abc"
npm run local:cf         # wrangler dev on :8082,        then: curl "localhost:8082/hash?input=abc"
npm run bench -- <base-url>
```

## Approach

One platform-free module (`src/core.ts`) holds all the behaviour: `GET /hash`,
`GET /info`, and a 404 for everything else. Each platform gets a short adapter
(`aws/index.ts`, `gcp/index.ts`, `cloudfare/index.ts`) that only converts the
platform's request into `Req`, calls `handle`, and converts `Res` back. Because
the behaviour is the same everywhere, any difference in Parts 2 to 4 comes from
the platform.

## Code walkthrough

- `core.ts` keeps `instanceId`, `requestCount` and `initMs` at **module level**.
  Module-level code runs once when an instance starts, so these three values are
  how a cold start shows up: a new `instanceId` and `requestCount` back at 1 mean
  a new instance. `handle` returns `Promise<Res>` (the stub in the challenge was
  synchronous) because `crypto.subtle.digest` is async. `node:crypto` has a
  synchronous hash, but Workers does not provide it by default, so I used the Web
  API.
- `initMs` is measured with `performance.now()` around the module-level setup.
  That only times the setup code in the module (a UUID), not the platform's own
  start-up work (starting the instance, loading the runtime). Treat it as a hint,
  not as the cold-start time.
- `aws/index.ts` reads the method from `requestContext.http.method`, the path from
  `rawPath`, the query from `queryStringParameters`, and decodes the body if
  `isBase64Encoded` is true. It returns `{ statusCode, headers, body }`.
- `gcp/index.ts` registers `functions.http("app", ...)`. `req` and `res` are
  Express objects. `--target=app` picks this function.
- `cloudfare/index.ts` is `export default { fetch }`. It parses `request.url` with
  `new URL` and returns a `Response`. (The folder name is spelled `cloudfare`; the
  code does not care, but the challenge text says `cloudflare`.)
- `bench.ts` sends one request, then 30 more one after another, and prints the
  first time, the median and p95 of the 30, and how many distinct `instanceId`
  values it saw.

## Part 2 — request shapes (from the docs)

| | AWS Lambda (Function URL, payload 2.0) | Cloud Run functions (functions-framework) | Cloudflare Workers |
|---|---|---|---|
| Your code receives | `event` object (plain JSON) | Express `req` and `res` | Web-standard `Request` |
| Method | `event.requestContext.http.method` | `req.method` | `request.method` |
| Path | `event.rawPath` (also `requestContext.http.path`) | `req.path` | `new URL(request.url).pathname` |
| Query | `event.queryStringParameters` (parsed), `event.rawQueryString` (raw) | `req.query` | `new URL(request.url).searchParams` |
| Headers | `event.headers` | `req.headers` / `req.get()` | `request.headers` (a `Headers` object) |
| Body | `event.body` (string; check `isBase64Encoded`) | `req.body` (already parsed by Express for known content types) | `await request.text()` / `.json()` |
| You return | `{ statusCode, headers, body, isBase64Encoded }` | `res.status(n).set(...).send(...)` | `new Response(body, { status, headers })` |
| Entry point | `export const handler` | `functions.http("name", fn)` | `export default { fetch }` |

Sources: AWS Function URL invocation docs, the functions-framework-nodejs README
and the Workers fetch docs (links at the end). Read on 2026-10-06.

### Predictions (written before the runs)

For each platform, the first request versus the rest:

- Is the first request slower than the rest? Yes.
- By how much? The first call about 100 ms; the calls after it about 5-10 ms.
- Is `instanceId` the same on all 30 requests? No, it will be different.

Whether these held is decided by the deployed runs in Part 4. The local runs
below cannot test the `instanceId` prediction: each local server is one process,
so it is one instance. See the Part 4 section for the first deployed numbers.

### Local runs

**AWS (fake Function URL event, `npm run local:aws`):** `/hash?input=abc` returned
`ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`. Five `/info`
calls returned the same `instanceId` (`34db754a-...`) with `requestCount` 2, 3, 4,
5, 6 (it starts at 2 because `/hash` was request 1), and `initMs` about 0.02 ms.
An unknown path returned 404.

**GCP (`functions-framework` on :8081, `npm run bench http://localhost:8081`):**

```
first request: 23.6 ms { instanceId: '38adb8d1-...', requestCount: 32, initMs: 0.0207 }
next 30: median 0.8 ms, p95 2.1 ms
distinct instanceId in the 30: 1
```

`requestCount: 32` on the "first" request shows this server had already served 31
requests, so this was a warm server, not a cold start. The 23.6 ms first request
is slower than the 0.8 ms median, but it is not a cold start.

**Cloudflare (`wrangler dev`):** the first run failed before serving any request:

```
Uncaught Error: Disallowed operation called within global scope. Asynchronous I/O
(ex: fetch() or connect()), setting a timeout, and generating random values are not
allowed within global scope. To fix this error, perform this operation within a handler.
```

My original `core.ts` called `crypto.randomUUID()` at module level, which is what
made `instanceId` per instance. Workers does not allow random values there. The
same code worked on AWS and GCP. The fix: create the ID on the first `/info`
request (`instanceId ??= crypto.randomUUID()`), still once per isolate. A check of
the adapter under plain Node had passed, so only the real Workers runtime found
this.

After the fix (`npm run local:cf`, wrangler 4):

```
curl "localhost:8082/hash?input=abc"
{"input":"abc","sha256":"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"}

curl localhost:8082/info
{"instanceId":"0a71cd06-7000-4e47-989b-c42f423a4bf0","requestCount":2,"initMs":0}

npm run bench http://localhost:8082
first request: 34.3 ms { instanceId: '0a71cd06-...', requestCount: 3, initMs: 0 }
next 30: median 2.3 ms, p95 4.2 ms
distinct instanceId in the 30: 1
```

The hash matches the AWS and GCP runs, so all three adapters agree for `abc`.
Two things differ from the other platforms. `initMs` is exactly 0 here, where AWS
and GCP showed about 0.02 ms. I did not look up why; the likely cause is that the
Workers clock does not advance while code runs, but check the Workers docs before
you write that as fact. And as on GCP, this "first request" (`requestCount: 3`)
came after earlier curls, so it is not a cold start.

## Part 3 — deploy

### Cloudflare Workers

```
npx wrangler login
npx wrangler deploy
```

`npx wrangler login` first (it was needed), then one deploy command from `src/`
(`wrangler.toml` already named the Worker and its entry file). So two commands in
total. The first deploy on a new account also asks you to register a
`workers.dev` subdomain: three prompts (register now, choose the name, confirm).
Output:

```
Total Upload: 1.58 KiB / gzip: 0.79 KiB
Uploaded day15-hash (3.58 sec)
Deployed day15-hash triggers (2.26 sec)
  https://day15-hash.day15-hash.workers.dev
```

About 6 seconds of upload and trigger set-up in total, and the URL is
`<worker-name>.<account-subdomain>.workers.dev`. The bundle is 1.58 KiB.

TODO: the most confusing step on Cloudflare (your words).

### AWS Lambda

Deployed with the AWS CLI as an IAM user (`Lambda-deployer`): create an execution
role, attach `AWSLambdaBasicExecutionRole`, `create-function` (Node 22, 128 MB),
`create-function-url-config` with auth type NONE, and two `add-permission` calls.
The URL has the form `https://<id>.lambda-url.<region>.on.aws`. The function ended
up in **us-east-1**, not the Mumbai region I had suggested, so the CLI probably used a
different default region (I did not check). That matters for the numbers below and for the clean-up.

TODO: number of commands, deploy time, the most confusing step (your words).

### Cloud Run functions

Deployed with `gcloud functions deploy day15-hash --gen2 --runtime=nodejs22
--region=asia-south1 --source=dist/gcp --entry-point=app --trigger-http
--allow-unauthenticated --memory=256Mi`, into my existing `ch-ai-in-portal` project.
Two things stood in the way:

- The first deploy failed with a 403, `Read access to project ... was denied: please
  check billing account`. The project had no billing account linked
  (`billingEnabled: false`). I linked my open billing account with
  `gcloud billing projects link`.
- The second deploy failed because the Cloud Functions API was not enabled. I had
  skipped the `gcloud services enable` step.

The URL has the form `https://<function>-<hash>-<region code>.a.run.app`.
Before the deploy the project had 0 functions, 0 Cloud Run services, 0 Artifact Registry
repositories and no storage buckets, so everything that appears afterwards comes from this
deploy.

TODO: number of commands, deploy time, the most confusing step (your words).

## Part 4 — cold start vs warm start

### Cloudflare Workers (deployed)

Three runs of `npm run bench` against the deployed Worker, one after another
(the URL was typed with `http://`, so the first request may also include a
redirect to HTTPS; I did not check):

| Run | First request | Same instance? (`requestCount` on the first request) | Median of next 30 | p95 |
|---|---|---|---|---|
| 1 | 106.8 ms | new instance (`requestCount: 1`) | 15.2 ms | 48.8 ms |
| 2 | 65.8 ms | same (`requestCount: 32`) | 14.8 ms | 44.3 ms |
| 3 | 94.0 ms | same (`requestCount: 63`) | 14.0 ms | 40.8 ms |

`initMs` was 0 in every run. All 93 requests returned the same `instanceId`
(`955137fb-...`).

What this shows, compared with the predictions:

- First request slower than the rest: **yes**, in all three runs.
- First request about 100 ms: run 1 was 106.8 ms, so that held. Runs 2 and 3 were 65.8
  and 94.0 ms.
- Later requests about 5-10 ms: **did not hold.** The median was 14.0 to 15.2 ms.
- `instanceId` different on every request: **did not hold.** One instance served
  all 93 requests.
- Runs 2 and 3 started on the same, already running instance (`requestCount` 32
  and 63), and their first requests were still 4 to 7 times slower than their
  medians. So the slow first request is not mainly the Worker starting. The bench
  opens a new connection for its first request (DNS lookup, TCP, TLS), and the next
  30 reuse it. That fits the numbers, but I did not time the connection setup
  separately, so it is an explanation and not a measurement.
- The 14 to 15 ms median includes the network trip from my Mac to the nearest
  Cloudflare location, so it is not the cost of running the function.
- I do not know how long the Worker had been idle before run 1. The
  `requestCount: 1` only shows that it was a new instance.

### AWS Lambda (deployed, us-east-1)

Four runs of `npm run bench` against the Function URL (runs 3 and 4 came after a
pause that I did not time):

| Run | First request | `requestCount` on the first request | Median of next 30 | p95 |
|---|---|---|---|---|
| 1 | 726.9 ms | 2 | 226.6 ms | 310.8 ms |
| 2 | 781.3 ms | 33 | 250.1 ms | 287.8 ms |
| 3 | 956.9 ms | 64 | 251.9 ms | 341.9 ms |
| 4 | 688.8 ms | 95 | 232.0 ms | 399.5 ms |

`initMs` was about 0.003 ms. All 126 requests returned the same `instanceId`
(`d059f782-...`): the instance from run 1 was still serving in run 4, and the counts
continue without a reset (63 requests by the end of run 2, 64 at the start of run 3).

- The medians are 227 to 252 ms, against 14 to 15 ms on Cloudflare. These are not
  comparable: this function is in us-east-1 and I ran the bench from my Mac, so the
  network trip is probably a large part of the number (I did not measure it).
- Run 1's first request had `requestCount: 2`. I had called `/hash` once before the
  bench, so the instance was already running and the 726.9 ms was not the function
  starting. Run 2 started on the same instance (`requestCount: 33`) and was slow too.
- The first request took about 3.0 to 3.8 times the median in all four runs (727 / 227,
  781 / 250, 957 / 252 and 689 / 232). If the function's own run time is only a few milliseconds, the median is
  about one network round trip, and a first request that needs a DNS lookup, a TCP
  connection, a TLS handshake and then the request would be about three round trips
  (about 3 times the median).
  That fits, but I did not measure the connection separately, so it is an inference.
**What the Lambda log shows** (`aws logs tail`, three bench runs, starting at 16:50:23,
16:55:11 and 16:55:29 UTC, about 90 to 100 invocations, all in one log stream, so one
execution environment):

- The function's own time was about 1.2 to 1.5 ms per request (`Duration`), billed as
  2 ms, with 77 MB of the 128 MB used. The client median was 227 to 252 ms, so almost
  all of the time I measured is outside the function.
- The first invocation of the 16:50 run took 1.33 ms inside Lambda (and 1.51 ms for the
  16:55:29 run), while the client measured 689 to 957 ms for its first request in the runs. So the slow first request
  did not happen inside the function. That supports the connection-setup explanation,
  though I still did not time the connection on its own.
- No `REPORT` line has an `Init Duration` field. This environment never started
  fresh in the logged window, so the log holds no cold start.
- After the gap between the first and second runs (16:50:31 to 16:55:11, about 4 min
  40 s), the first invocation took 180.61 ms and the second 59.50 ms, against 1.2 to
  1.5 ms for the rest.
  The cause is not known; I did not test it. The environment was reused, not replaced.
- Billing check: 1.3 ms billed as 2 ms means my 50 ms assumption in the cost section
  was about 25 times higher than what this function used.

**A real cold start (forced by changing the function's configuration).** After an
environment variable change, the next invocation ran in a new log stream
(`5469b8b8...`, the old one was `2182e4bd...`), and the log shows:

```
INIT_START Runtime Version: nodejs:22.mainline.v122
REPORT  Duration: 150.73 ms  Billed Duration: 312 ms  Memory Size: 128 MB
        Max Memory Used: 75 MB  Init Duration: 160.76 ms
```

- **Init Duration: 160.76 ms.** This is the time to start the runtime and load the
  module, before any request runs.
- **The first invocation took 150.73 ms** inside the handler, against 1.2 to 1.8 ms for
  most of the next 30. The handler did the same work (`/info`). Why the first call is
  that slow, I did not test.
- **Billed Duration: 312 ms**, which is 150.73 + 160.76 = 311.49 ms rounded up. So on
  this function the Init time was billed, which matches the Lambda pricing page.
- Together, about 311 ms inside Lambda before the first answer, against about 1.3 ms
  for a warm request.
- The 4th invocation of the new environment took 40.58 ms, then it returned to about
  1.3 to 1.8 ms. I did not look for the cause.
- The `INIT_START` line is at 16:58:33.749 and the first `START` at 16:58:33.914, a gap
  of 165 ms, close to the Init Duration.
- Compare with the warm environment after a pause: its first invocation (180.61 ms)
  had no Init Duration, so a slow first invocation after idle is not the same as a cold
  start. The cause of that 180.61 ms is still unknown.

TODO: paste the `npm run bench` output for this run (first request, `requestCount`,
`instanceId`). I have the log side only, not the time my client measured for this
cold request. Expected: `requestCount: 1` and a new `instanceId`.

### Cloud Run functions (deployed, asia-south1)

Two runs of `npm run bench`:

| Run | First request | `requestCount` on the first request | Median of next 30 | p95 |
|---|---|---|---|---|
| 1 | 191.4 ms | 2 | 44.0 ms | 60.9 ms |
| 2 | 136.2 ms | 33 | 41.9 ms | 70.7 ms |

`initMs` was about 0.005 ms. All 63 requests returned the same `instanceId`
(`b03f33f5-...`).

- The first request took 3.3 to 4.3 times the median (191.4 / 44.0 and 136.2 / 41.9),
  again including a run that started on an instance that was already running
  (`requestCount: 33`).
- Run 1 had `requestCount: 2`: I had called `/hash` once with `curl` right after the
  deploy, so that call was the first request to the new revision. I did not time it and
  I have no log for it, so I cannot say whether it was a cold start.
- The medians cannot be compared with the other two platforms: this function is in
  asia-south1 and the Lambda is in us-east-1. Cloudflare's median was 14 to 15 ms. I ran
  all of them from my Mac, and I did not measure the network distance to any of them.

**A forced cold start.** I redeployed with `--update-env-vars FORCE=1`, which creates a new
revision, then ran the bench once:

```
first request: 174.4 ms { instanceId: '9060df8b-...', requestCount: 1, initMs: 0.0056 }
next 30: median 46.2 ms, p95 54.0 ms
distinct instanceId in the 30: 1
```

- A new `instanceId` and `requestCount: 1`: this was a fresh instance.
- The first request took 174.4 ms, 3.8 times the median. That is inside the range of
  the first requests that landed on an already running instance (136.2 ms and 191.4
  ms). So with one cold sample from my Mac I cannot see the cost of the instance
  starting, separate from the connection setup. A better test needs more cold samples, or
  a start-up time from the platform's own log.
- I did not capture a platform log for this request, so I have no Google-side start-up
  time like Lambda's `Init Duration`.

TODO (optional): `gcloud functions logs read day15-hash --gen2 --region=$REGION
--limit=50`, and paste what it shows (or say that it shows nothing about start-up).

## Part 5 — limits and pricing

All numbers below were read from the official pages on **2026-10-06**. These
numbers change. Open each link and check before you quote them in the blog post.

### Limits

| | AWS Lambda | Cloud Run functions (2nd gen) | Cloudflare Workers |
|---|---|---|---|
| Longest request | 900 s (15 min) for a standard function | 60 min for HTTP functions | Free: 10 ms **CPU** time. Paid: CPU time up to 5 min (default 30 s). HTTP wall-clock time: "No limit" while the client stays connected |
| Memory | 128 MB to 10,240 MB | up to 32 GiB (the quotas page lists the maximum, not the steps) | 128 MB per isolate |
| Request body | 6 MB (synchronous) | 32 MB (uncompressed HTTP) | 100 MB on Free and Pro accounts (depends on the Cloudflare account plan) |
| Response body | 6 MB; 200 MB if streamed | 32 MB (non-streaming); 10 MB (streaming) | No enforced limit (CDN cache limits apply) |
| How CPU is given | In proportion to memory; 1,769 MB is about one vCPU | Not stated on the quotas page | Not tied to memory. CPU time is what is limited and billed |
| Code size | 50 MB zipped, 250 MB unzipped, 10 GB container image | Not listed for 2nd gen on the quotas page | 64 MiB uncompressed |

TODO: the Cloud Run functions row for "how CPU is given" is not on the quotas
page. Find it in the function configuration docs and write the link here.

### Pricing model

| | AWS Lambda | Cloud Run functions | Cloudflare Workers |
|---|---|---|---|
| What is billed | Requests + duration in GB-seconds. Duration is rounded up to 1 ms. Code outside the handler (init) is billed as duration too | Requests + vCPU-seconds + GiB-seconds of active time, rounded up to the nearest 100 ms | Requests + **CPU time** (not wall time) |
| Free each month | 1M requests and 400,000 GB-seconds | 2M requests, 180,000 vCPU-seconds, 360,000 GiB-seconds | Free plan: 100,000 requests a day, 10 ms CPU per request |
| After the free part | $0.20 per 1M requests; $0.0000166667 per GB-second (us-east-1, both x86 and Arm) | $0.40 per 1M requests; $0.000024 per vCPU-second; $0.0000025 per GiB-second (Tier 1 regions, us-central1) | Paid plan $5 a month minimum, includes 10M requests and 30M CPU-ms; then $0.30 per extra 1M requests and $0.02 per extra 1M CPU-ms |

### Cost of three workloads

Assumptions (change them and the answer changes):

- "Small memory" = 128 MB on Lambda; 256 MiB and 0.167 vCPU on Cloud Run
  functions (the configuration Google uses in its own pricing example; I did not
  find the default on the quotas page); Workers has no memory setting.
- A 30-day month, one request at a time per instance, free tiers fully available.
- For Workers, the billed number is CPU time, not the 50 ms. A tiny hash needs
  little CPU, so I show 5 ms of CPU per request and, as a worst case, 50 ms.
- My formula reproduces the $7.25 that Google's pricing page gives for its
  "Example 4" (10M requests, 200 ms, 0.167 vCPU, 256 MiB), so I trust the
  arithmetic for that platform.

**Workload 1 — 1M requests a month, 50 ms each**

- Lambda: requests 1M, all inside the free 1M. Duration: 1M x 0.05 s x 0.125 GB
  = 6,250 GB-s, inside the free 400,000. **$0.**
- Cloud Run functions: 50 ms rounds up to 100 ms. CPU: 1M x 0.1 x 0.167 = 16,700
  vCPU-s. Memory: 1M x 0.1 x 0.25 = 25,000 GiB-s. Both inside the free tier.
  **$0.**
- Workers: 1M a month is about 33,000 a day, under the Free plan's 100,000 a day,
  and a tiny hash is well under 10 ms of CPU. **$0 on the Free plan.** On the Paid
  plan: **$5** (the minimum).

**Workload 2 — 100M requests a month, 50 ms each**

- Lambda: requests (100M - 1M) x $0.20 / 1M = $19.80. Duration: 100M x 0.05 x
  0.125 = 625,000 GB-s; minus 400,000 free = 225,000 x $0.0000166667 = $3.75.
  **About $23.55.**
- Cloud Run functions: requests (100M - 2M) x $0.40 / 1M = $39.20. CPU: 100M x
  0.1 x 0.167 = 1,670,000 vCPU-s; minus 180,000 free = 1,490,000 x $0.000024 =
  $35.76. Memory: 100M x 0.1 x 0.25 = 2,500,000 GiB-s; minus 360,000 free =
  2,140,000 x $0.0000025 = $5.35. **About $80.31.** The 100 ms rounding doubles
  the billed time here.
- Workers (Paid): requests (100M - 10M) x $0.30 / 1M = $27. CPU at 5 ms: 100M x 5
  = 500M CPU-ms; minus 30M = 470M x $0.02 / 1M = $9.40. Plus the $5 minimum.
  **About $41.40.** If each request used the full 50 ms of CPU: 5,000M - 30M =
  4,970M x $0.02 / 1M = $99.40, so **about $131.40.**

**Workload 3 — a job with 4 minutes of run time, 20 times a day (600 runs a month)**

- Lambda: inside the 15-minute limit. 600 x 240 s x 0.125 GB = 18,000 GB-s, inside
  the free tier. **$0.**
- Cloud Run functions: inside the 60-minute limit. CPU 600 x 240 x 0.167 = 24,048
  vCPU-s; memory 600 x 240 x 0.25 = 36,000 GiB-s; both inside the free tier.
  **$0.**
- Workers: needs the Paid plan, so **at least $5.** If the job waits on other
  services most of the time, its CPU use is small and the bill stays near $5.
  If it computes for the whole 4 minutes: 600 x 240,000 ms = 144M CPU-ms; minus
  30M = 114M x $0.02 / 1M = $2.28, so **$7.28**, and you must raise the CPU limit
  above its 30 s default (the limit page says up to 5 min).

Caution: the free tiers are per account, and the numbers above ignore network
egress, logging, and anything the function calls. At these sizes the money is
small; the limits and the behaviour matter more.

TODO: which platform would you choose for each workload, or none? (A virtual
machine or a container service may be a better answer for workload 3 if the job
grows, or for anything that needs more than one request at a time on the same
instance.) This is your call, not mine.

## Part 6 — decision table

TODO: your own table: for which kind of work would you pick each platform, and
for which kind of work none of them. Use your cold-start numbers from Part 4.

## Clean-up check

Cloudflare Workers: `npx wrangler delete` printed `Successfully deleted day15-hash`.

TODO: confirm the Worker is gone (`npx wrangler deployments list` should now fail
or show nothing for `day15-hash`, or open the Workers page in the dashboard).

AWS Lambda (us-east-1): I ran the delete commands (function URL, function, log group,
the role policy and the `day15-hash-role` role) and the Lambda is destroyed. I did not
paste the output of the check commands, so the list below is not in this file yet.

TODO (optional but better evidence): run these and paste the output here:

```
aws lambda list-functions --query 'Functions[].FunctionName' --region us-east-1
aws logs describe-log-groups --log-group-name-prefix /aws/lambda/day15 --region us-east-1
aws iam get-role --role-name day15-hash-role      # NoSuchEntity expected
```

Cloud Run functions: TODO (after your tests) run `gcloud functions delete day15-hash
--gen2 --region=$REGION` and the checks in the GCP clean-up notes.

## Gotchas / things that tripped me up

- The sandbox I used to check the code could run the Lambda and Google adapters
  but could not start the Cloudflare runtime, so the Worker adapter was only
  checked under plain Node (the `Request` and `Response` classes exist there).
  `wrangler dev` on your Mac is the real test.
- `functions-framework` loads JavaScript. To run the TypeScript source locally,
  the `local:gcp` script starts it through `tsx`. For a real deploy, build to
  JavaScript or follow the platform's TypeScript guide.
- Workers does not allow random values in global scope. `crypto.randomUUID()` at
  module level crashed `wrangler dev` at start-up. The ID is now created on the
  first `/info` request (see Part 2).
- A local "first request" is not a cold start if the server was already used
  (`requestCount` was 32). Start the server fresh before you read the number.
- `initMs` is tiny on every platform because it only times module-level setup.

## What I'd do differently

TODO.

## Further reading

- https://docs.aws.amazon.com/lambda/latest/dg/urls-invocation.html
- https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html
- https://aws.amazon.com/lambda/pricing/
- https://github.com/GoogleCloudPlatform/functions-framework-nodejs
- https://docs.cloud.google.com/functions/quotas
- https://cloud.google.com/run/pricing
- https://developers.cloudflare.com/workers/runtime-apis/fetch/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/platform/pricing/
