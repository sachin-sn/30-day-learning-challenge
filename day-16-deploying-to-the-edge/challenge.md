# Day 16 — Deploying to the Edge

**Difficulty:** Intermediate
**Tech stack:** TypeScript, Cloudflare Workers (Wrangler), Workers KV, Durable Objects (SQLite-backed), Web Crypto; Vercel Edge as the bonus round
**Estimated time:** 3-4 hours

## Why this matters

On Day 15 you ran one function on three platforms and measured it from one
laptop. Cloudflare Workers was the closest and the fastest, and you wrote
down that most of that gap was probably distance, which you did not
measure. Today you look at what "the edge" is: your code runs in many data
centers, and each request is handled in one near the caller. That is a
different model from "one function in one region", and it changes three
things you took for granted on a normal server:

- Where does your code run for a given caller, and how can you see it?
- What happens to data? A cache, a counter and a lock each behave
  differently when there are many copies of your code.
- What work should you do at the edge, and what should you leave on your
  origin server?

Day 15 left an open question: how much of a first request is connection
setup, and how much is your code? Today you time that directly.

## Learning objectives

By the end of today you should be able to:

- Say which data center handled a request, and show how that changes with
  where the request comes from
- Split the time of one request into DNS, connection, TLS, wait and
  transfer, and say which part the edge can shorten and which part it cannot
- Cache a response at the edge, show a hit and a miss, and explain why a
  cache in one data center does not help a caller in another
- Show what goes wrong when you count with an eventually consistent store,
  and fix it with a store that gives one writer
- Check a signed request at the edge, so that bad requests never reach the
  origin, and measure the difference
- Say what does not belong at the edge, using the limits in the
  documentation
- Delete everything you deployed, and prove it

## The challenge

Put all code in `src/`. Write down results as you go. The numbers you
measure are the evidence, the same way the plan output was on Day 14 and
the log lines were on Day 15.

**Part 1 — where does it run, and where does the time go.** Write a Worker
with one route, `GET /where`. It returns JSON with the data center code
(`colo`), the country, the HTTP version and the TLS version. These are not
properties of the request itself. They are on `request.cf`, a separate
object that Cloudflare adds. Read the docs page for `request.cf` and find
the exact names. For TypeScript, you need the Workers types (see
`wrangler types` or `@cloudflare/workers-types`), or `cf` is unknown.

Write your predictions first: when you call it from your Mac, which data
center do you expect, and why? What do you expect `time_connect` and
`time_starttransfer` to be? Then run `wrangler dev` and call it. Deploy and
call it again. Compare the two. If a field is empty in one of them, find in
the documentation why, and write it down.

Then time one request in parts, with `curl`. Use `-w` with the timing
variables (`time_namelookup`, `time_connect`, `time_appconnect`,
`time_starttransfer`, `time_total`). Run it twelve times: the first one
fresh, then eleven in a row, and for each run say which part changed. Day 15
said the slow first request was probably connection setup. Now you have the
number. Did it hold?

Then change where the request comes from. Use your phone on mobile data, a
VPN to another country, or a free public tool that calls a URL from another
location. Say which data center answered, and what happened to the
connection time. If you cannot do any of these, say so and say what you
would have done.

**Part 2 — cache at the edge.** Write `GET /slow`. It calls a slow origin and
returns the result. The origin can be any URL you control, or a second small
Worker of yours that waits two seconds before it answers. Do not use someone
else's server for repeated requests.

Add a cache in front of the slow call. Return a header that says `HIT` or
`MISS`, and the age of the cached copy. Set a time to live of 30 seconds.

Write your predictions first: how long does a miss take? A hit? What
happens after 30 seconds? If you call from two different locations, does the
second location see a hit?

Read the documentation of the Cache API and of `fetch` with `cf` options
**before you deploy**. Check where each one is said to work, and then test it
on your own URL. Write down what the docs say, what you saw, and which
approach you used in the end. If they disagree, say so.

Then test it: call `/slow` ten times from your Mac and print the status and
time of each. Call it from a second location, if you have one, and show
whether it hit. Say in one paragraph why a cache at the edge has a
different hit rate than a cache in front of one server.

**Part 3 — state at the edge: counting.** Add `POST /count/kv` and
`POST /count/do`. Each adds 1 to a counter and returns the new value.

- `/count/kv` stores the counter in Workers KV (read the value, add 1,
  write it back)
- `/count/do` stores the counter in a Durable Object, using SQLite storage

Write your predictions first: if 50 requests arrive at the same time, what
is the final value for each? Why?

Then write `src/load.ts`. It sends 50 requests at the same time to one
endpoint, waits for all of them, reads the final value, and prints how
many requests succeeded, the final value, and the distinct values the
requests returned. Run it against both endpoints, three times each. Then
wait 60 seconds and read the KV counter from the other side of the world,
or from a second location, if you can. What do you see?

Read the documentation for KV consistency, and the documentation for what a
Durable Object is, before you decide what you saw. This is Day 12's rate
limiter and Day 13's lost update, seen again: a counter that is not
atomic is wrong the moment two writers meet. Say which of those two days
the KV counter looks like, and why.

Check in the documentation whether the free plan allows a Durable Object,
and which storage type it needs. Check the limit on KV writes for the free
plan, and make sure that your test cannot go over it. Write down the numbers
with a link and the date.

**Part 4 — check a signed request at the edge.** Add `POST /orders`. A
request must carry the headers `x-timestamp` and `x-signature`. The
signature is an HMAC-SHA256 of the timestamp and the body, written in hex,
made with a secret that only the client and the Worker know.

At the edge, the Worker must:

- reject a request with a missing or wrong signature (`401`)
- reject a request whose timestamp is more than 5 minutes old (`401`), so
  that an old request cannot be played again
- compare the signatures in a way that does not leak where they differ
- pass only a valid request to the origin (your slow origin from Part 2 is
  enough; the origin may only answer `ok`)

Use `crypto.subtle` only. Put the secret in Workers secrets
(`wrangler secret put`) for the deployed Worker, and in `.dev.vars` for
`wrangler dev`. Never write the secret in a file that Git tracks, or on the
screen in your write-up.

Write your predictions first: how long does a rejected request take, and how
long does a valid one take? Then measure each: 20 valid requests, 20 with a
wrong signature, 20 with an old timestamp. Print the median and the 95th
percentile for each group, and show that a rejected request never called the
origin (for example, with a counter at the origin, or `wrangler tail`).

This is a small preview of Day 20 (OAuth2, OIDC and JWT). Today the point is
only where the check happens and what it saves.

**Part 5 — limits and what does not belong at the edge.** Find these facts
in the **official** documentation. Do not use a blog post, and do not
copy a number from this file or from memory. Put the link and the date you
read it next to every number:

- CPU time and memory per request, for the free and the paid plan
- the number of subrequests per request
- the largest request body, and the size of the Worker after it is built
- what you can and cannot do in the global scope (you met this on Day 15)
- how many writes to KV are free each day, and what happens when you go over
- the free limits of Durable Objects, and the storage type allowed

Then answer for each of these tasks: edge, origin, or both, and why.

1. Add a header, redirect by country, or A/B test by cookie
2. Check a signed request or a token, then pass the request on
3. A product page that is the same for everyone and changes once an hour
4. A shopping cart for one user
5. A report that reads 2 GB from a database and takes two minutes
6. A WebSocket chat room (see Day 10)

**Part 6 — put it together in solution.md.** Write up what you observed: the
timing split, the data centers you saw, the cache results, the counter
results, the signature timing, the limits table with links and dates, and
your decision table. Finish with the clean-up check (see below).

### Requirements

- Predictions written before Parts 1, 2, 3 and 4, with whether each held
- A timing split for one request, with the connection time shown on its own
- A cache test with a visible hit and miss, and a note on what you changed
  after reading where the Cache API works
- A 50-request test of both counters, three runs each, with real output
- A rejected request that is shown not to reach the origin
- A limits table with a link and a date next to every number
- `solution.md` written from real output

### Constraints

- Free plan only. Do not enable a paid plan, and keep every test inside the
  free limits (write the numbers in `solution.md`)
- Never put a secret, a token or an account ID in a file in this repo.
  Use `wrangler login`. Add `.dev.vars`, `.env`, `.wrangler/` and
  `node_modules/` to `.gitignore` before the first deploy. Do not hard-code
  `account_id` in `wrangler.toml`
- Do not use a framework such as Hono, itty-router or Next.js for the core
  challenge. You want to see the Workers model
- Do not send repeated or concurrent requests to a server that is not
  yours. The 50-request test goes only to your own Worker
- Do not read numbers for limits from memory or from this file. Read them
  from the official documentation on the day, and write the date
- Delete everything you deployed when you finish, and prove it (see the
  clean-up check)

### Clean-up check

At the end, show that nothing is left: the Workers (`wrangler deployments
list` or the dashboard), the KV namespaces (`wrangler kv namespace list`),
the Durable Object classes and their data, and the secrets. A Durable Object
is deleted with a migration, not with a plain delete of the Worker. Read the
documentation for how to do it, and put the commands and the output in
`solution.md`.

## Bonus round (optional)

- Run the same `/where` and `/slow` on Vercel's edge runtime. Check the
  current documentation first: what does Vercel recommend today for this
  kind of function, and what did you have to change in the code?
- Add a custom domain to the Worker, or put it behind one, and repeat the
  cache test. What changed? What did you learn about `workers.dev`?
- Use the Cache API with a `Vary` header and show that two variants are
  cached separately
- Compare the same counter with Day 4's Redis in one region: from your Mac,
  what is the difference in time for one increment, and in what way is it
  more correct?
- Use `wrangler tail` during Part 3 and show one request that was handled by
  more than one instance of your Worker at the same time
- One paragraph: which of your earlier days would not work at the edge, and
  why? Think about Redis connections (Day 4), Kafka consumers (Day 7) and
  gRPC (Day 11).

## Resources

- https://developers.cloudflare.com/workers/reference/how-workers-works/
- https://developers.cloudflare.com/workers/runtime-apis/request/
- https://developers.cloudflare.com/workers/runtime-apis/cache/
- https://developers.cloudflare.com/kv/concepts/how-kv-works/
- https://developers.cloudflare.com/durable-objects/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/workers/runtime-apis/web-crypto/

---

Once you've built something, write up `solution.md` in this folder using
`../_template/solution.md` as a starting point.
