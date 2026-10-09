---
title: "Day 18 — I Guessed 20%. The Slow Function Was 95% to 100% of the Request"
date: "2026-10-09"
excerpt: "I added OpenTelemetry to a small Node server and printed the spans to the console. My guess for how much of a request one slow function would take was 20%. The real number, over five requests, was between 95% and 100%."
tags: ["30-day-challenge", "day-18", "observability", "opentelemetry", "tracing", "nodejs", "typescript"]
draft: true
---

Day 17 ended with a cluster where I could see that something was wrong (a
stuck rollout) but not why. Day 18 is about the tool for that question: a trace.
I took a small Express server, added OpenTelemetry, and printed every span to
the console. No collector, no UI, no metrics. From today I also use a shorter
format for the challenge, about 90 minutes per day, so this post is shorter too.

## The setup

Three pieces in `instrumentation.ts`: the Node SDK, a `ConsoleSpanExporter`, and
the automatic instrumentations. I start the server with
`tsx --import ./instrumentation.ts index.ts`, so the setup file runs before the
server code. <!-- TODO (Sachin): one sentence on what happened when the setup file loaded in the wrong order, or delete this comment if you did not test it -->

I wrote two predictions before I wrote any code. How many spans would one
`GET /hash` print? I said 5. What share of the request time would a function that
waits about 200 ms take? I said 20%.

## What a request looks like

Then I added `slowLookup()`, which waits 100, 200 or 300 ms inside its own span,
and sent five requests. Every `/hash` request printed 5 spans. Four came from the
automatic instrumentation (`GET /hash`, `middleware - patched` and two
`request handler - /hash`) and one is mine. So my number 5 matches the total, but
I had not counted my own span when I wrote it down, and I do not want to claim
more than that.

The parent ids give a tree. For the first request:

```
GET /hash                        (root)
  middleware - patched
    request handler - /hash
      request handler - /hash
        slowLookup
```

I did not pass any context to `slowLookup`. It became a child of the handler span
by itself.

## The 20% was wrong

```
trace      slowLookup ms   GET /hash ms   share
45263815   201.5           211.3          95.4%
7cbafc63   301.4           304.1          99.1%
cc4ff7d7   201.2           203.8          98.7%
00b8906d   300.3           301.1          99.7%
d731a5b3   201.2           205.1          98.1%
```

The share was between 95% and 100%. The rest of the request took 0.8 to 9.8 ms,
so a function that waits 100 to 300 ms is nearly the whole request. My 20% had no
reason behind it, I just did not think about how small the other part is. The
first request had the largest gap (9.8 ms). I do not know why.

## What a failure looks like

`GET /fail` throws an error inside my own `failWork` span. I catch it, call
`span.recordException(err)`, set the status to error, send a 500, and end the
span. The `failWork` span in the output has `status: { code: 2, message: 'something broke' }`
and an `exception` event with the type, the message and a stack trace whose
first line points at the `throw` in `index.ts`.

The automatic HTTP span for the same request, `GET /fail`, also has
`status: { code: 2 }`, with no message and no events. It got its error status from
the 500 response (`http.response.status_code: 500`). So the detail of what broke
is only on the span where I recorded it. I did not run `/fail` without my own
`recordException`, so that last point is my reading of the two spans and not
something I tested.

## What I'm leaving open

Five requests and one failing request, so no spread to speak of. I did not look
into the extra 0.8 to 9.8 ms. No collector or trace viewer, no metrics, no
sampling. `instrumentation.ts` also has a metrics exporter that I added and did not
use for anything.

## What's next

Day 19 is CI/CD: a GitHub Actions matrix build and a small canary script. Full
code in the [repo](#) — `day-18-observability-opentelemetry/`.
