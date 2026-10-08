---
title: "Day 16 — 50 Requests, a Counter of 1"
date: "2026-10-07"
excerpt: "One Cloudflare Worker, tested from two cities. A cache that worked where I did not expect it to, a cache option that did nothing, and a counter in Workers KV that ended at 1 after 50 increments."
tags: ["30-day-challenge", "day-16", "edge", "cloudflare-workers", "workers-kv", "durable-objects", "typescript"]
draft: true
---

Day 15 ended with a question I could not answer: how much of a slow first
request is the function, and how much is setting up the connection? Day 16 stays
on Cloudflare Workers and asks what changes when your code runs in many
data centers instead of one region. I built one Worker with five routes and
tested it from my Mac and from Google Cloud Shell. This post covers what I
measured and what I did not.

## Where does it run?

`GET /where` returns the data center, the country, the HTTP version and the TLS
version. None of these are on `request`. They are on `request.cf`, an object
Cloudflare adds, and TypeScript only knows about it after `wrangler types`.

From my Mac the deployed Worker answered from `MAA` (Chennai). From Cloud Shell
the same Worker, with no setting changed, answered from `SIN` (Singapore). There
is no region to choose. This is the opposite of Day 15, where I picked
us-east-1 for Lambda and asia-south1 for Google.

In `wrangler dev` the answer looked wrong. The JSON said `TLSv1.3`, but my local
request had no TLS at all. The file `.wrangler/cache/cf.json` holds the same values,
so locally `request.cf` looks like a stored copy, not a description of the local
connection. That is my reading of the file, not something I found in the docs.

## Where does the time go?

I timed the deployed Worker with curl, 24 separate calls from the Mac. Each call
opens a new connection, so each one pays for DNS, TCP and TLS.

```
              fastest   median   slowest
batch 1       51.2 ms   122.8    315.5
batch 2       55.3 ms    90.2    281.2
```

The fastest runs are almost the same in both batches. Everything above them is
spread. TCP plus TLS was about half of the total in batch 1 and about three
quarters in batch 2, and the slow step was not always the same one. TCP took 113 ms
in one run, before any Worker code could run, so that delay was not my code. A
`ping` to the same host gave a minimum of 14.5 ms, a median of about 46 ms and a
maximum of 203 ms. The spread is in the network between my Mac and the edge.

From Cloud Shell, `clientTcpRtt` was 1, and TCP connect took 1.8 to 2.7 ms in 8 of
12 runs. I expected that to give a much better best case. It did not: 53 ms,
against 51 and 55 ms from the Mac. The TLS step took 38 to 41 ms in nearly every
fast run, even with TCP at 2 ms. A TLS 1.3 handshake needs about one round trip, so
distance cannot explain 38 ms. I do not know what does. The two clients are also
different machines, so this is a hint and not a clean comparison. In 4 of 12 runs
TCP took 35 to 41 ms and those runs were also the slowest.

## A cache that worked, and one that did nothing

The slow origin is a second Worker that waits two seconds. In front of it I built
two routes with a 30-second time to live. One uses the Cache API. The other uses
`fetch` with `cacheEverything` and `cacheTtl`.

My predictions were a miss of about 50 ms, a hit of about 100 ms, and a timeout
after 30 seconds. All three were wrong, and the first was impossible, because the
origin waits 2000 ms. Real numbers for the Cache API route:

```
miss      2431.6 ms at the client, 2057 ms inside the Worker
hits      median 30.2 ms (27.4 to 154.9), 4 to 16 ms inside the Worker
```

All ten answers had the same origin timestamp, so nine of them were the stored
copy. Called every 12 seconds, it was a hit at 12 s and at 24 s. At about 36 s it
was a miss again, with a new timestamp, and that caller waited 2105 ms. Nothing
timed out. After a 12 s pause the hits took 167 and 190 ms at the client, but only
7 and 4 ms inside the Worker. I think the pause closed my connection, but I did not
check.

The `fetch` route did not cache. All ten calls took about two seconds and reached
the origin, and the response had no `cf-cache-status` header at all. I tried
three ideas for why (the origin is another Worker on `workers.dev`, the options do
not apply to such a call, or a compatibility flag I set changes the path), and I
tested none of them.

I also first understood the Cache API docs to say it does not work on
`workers.dev`. The sentence on the page is: "Workers deployed to custom domains
have access to functional `cache` operations." It says where it works and does not
say that `workers.dev` fails. In my run it worked there.

I could not answer whether a second city sees the first city's copy. Cloud Shell got
its own miss and then two hits, but the copy made in `MAA` was about 200 seconds
old by then, so it had expired anyway. The docs say the Cache API does not
replicate outside the data center that made the copy. I have not seen that in my own
test.

## 50 requests, a counter of 1

Two counters: Workers KV with read, add one, write back, and a Durable Object with
one SQL update. I sent 50 increments at the same time to each.

```
KV    48 ok, 2 failed (429), every success returned 1, final value 1
DO    50 ok, values 1 to 50 each once, final value 50
```

All 48 successful KV requests read the value 0 before any write landed, so each
wrote 1. That is 47 lost increments. It is the lost update from Day 13, and a
rate-limit counter built this way (Day 12) would count wrongly too. The Durable
Object gave 50 distinct values and a final value of 50. I ran each store once,
not three times, so the timings (2106 ms for KV, 352 ms for the Durable Object)
are one sample. The KV docs say one write per second to the same key, yet 48 of 50
writes in the same moment went through, and I do not know why.

## Checking a signed request at the edge

`POST /orders` needs a timestamp and an HMAC-SHA256 signature. The Worker rejects a
missing or wrong signature, and a timestamp more than five minutes off, with 401.
Valid requests go on to the origin.

```
                          median     p95
valid (200 x 20)          36.1 ms    130.7 ms
wrong signature (401)     22.6 ms     46.1 ms
old timestamp (401)       23.0 ms     59.8 ms
```

A second run gave 40.8, 23.0 and 27.5 ms. A valid request cost 13 to 18 ms more at
the median, covering the check and the call to the origin; I did not split those
two. The origin's own counter was no good as proof, because it counts per instance:
it went up by 10 for 20 valid requests. Instead I ran `wrangler tail` on the origin
during a run of 60 requests. It showed 20 `POST /orders`, one for each valid
request. A bad request never got past the edge. A replayed valid request would
still pass for five minutes, because I did not build a nonce store.

## What I'm leaving open

I wrote predictions for Parts 1 and 2 only, not for the counters or the signed
requests. I did not time the connection on its own, and I do not know why TLS took
38 ms from Cloud Shell. The cross-city cache test is not done, and I have one run
of each counter. I deleted the two Workers, the KV namespace and the Durable Object, but I did not
save the command output, so I cannot show proof of the clean-up here. The Durable
Object needs a delete setting of its own, because deleting the Worker does not
remove it.

## What's next

Day 17 moves from the edge to containers: Docker multi-stage builds and a minimal
Kubernetes setup. Full code in the [repo](#) — `day-16-deploying-to-the-edge/`.
