# Day 18 — Solution: Observability with OpenTelemetry

> Status: Part A and Part B done. One line is still open: the note about the setup file order (see "How I started it").

## Predictions (written before the work)

1. How many spans for one `GET /hash` with the automatic instrumentation only? **5 spans per request.**
2. What percent of the whole request time will the 200 ms function's span be? **20%.**

Results:

1. The `/hash` requests printed 5 spans each, but that count includes my own `slowLookup` span, so it is not "automatic only". The automatic part was 4 spans: `GET /hash`, `middleware - patched` and two `request handler - /hash`. My number 5 matches the total I measured. It does not match the question as written, because I had not added `slowLookup` when the question was asked.
2. Wrong. The share was 95% to 100% (table below), not 20%. The random wait is 100, 200 or 300 ms and everything else in the request takes a few ms, so the wait is nearly the whole request.

## How I started it

`npx tsx --import ./instrumentation.ts index.ts > spans.log 2>&1`, run from `src/`. `instrumentation.ts` starts the `NodeSDK` with a `ConsoleSpanExporter` and the automatic instrumentations. TODO: one line on what happened when the setup file was loaded in the wrong place, if I tried that.

## Output

`node summarize.mjs spans.log` (span lines, trimmed to 5 requests and the failing request):

```
trace      span id          parent           ms      name
45263815  6011a3f3e2dc0855  2e9e7f4a31ac70b8   201.5  slowLookup
45263815  2f809a4d60604ac4  -                  211.3  GET /hash
45263815  2e9e7f4a31ac70b8  c88cd17e435166c5   209.5  request handler - /hash
45263815  c88cd17e435166c5  9e9b3d7fe91022b1   209.6  request handler - /hash
45263815  9e9b3d7fe91022b1  2f809a4d60604ac4   210.1  middleware - patched
(... 4 more /hash traces, 5 spans each ...)
b836f5c9  0e5da99e6cd39f98  6f88256eaedaa45b     1.5  failWork
b836f5c9  39b5fbbf655b220f  -                    2.2  GET /fail
b836f5c9  6f88256eaedaa45b  3428b8c1ec88decd     1.9  request handler - /fail
b836f5c9  3428b8c1ec88decd  ead65ca6be0fd8f9     1.9  request handler - /fail
b836f5c9  ead65ca6be0fd8f9  39b5fbbf655b220f     2.0  middleware - patched
```

The parent ids give this tree for one request (read from the first trace above): `GET /hash` (root, no parent) → `middleware - patched` → `request handler - /hash` → `request handler - /hash` → `slowLookup`. I did not pass any context to `slowLookup`. It became a child of the handler span by itself.

Table for the 5 `/hash` requests (shares are my division of the two durations from the output; I rounded to one decimal):

| trace | `slowLookup` ms | `GET /hash` ms | share |
| --- | --- | --- | --- |
| 45263815 | 201.5 | 211.3 | 95.4% |
| 7cbafc63 | 301.4 | 304.1 | 99.1% |
| cc4ff7d7 | 201.2 | 203.8 | 98.7% |
| 00b8906d | 300.3 | 301.1 | 99.7% |
| d731a5b3 | 201.2 | 205.1 | 98.1% |

The time outside `slowLookup` was 0.8 to 9.8 ms per request. I did not look into what is in it (the first request had the largest gap; I do not know why).

`/fail` (one request): 5 spans, `GET /fail` took 2.2 ms and `failWork` 1.5 ms.

`failWork` span (from `spans.log`, trimmed):

```
name: 'failWork',
duration: 1510.708,
status: { code: 2, message: 'something broke' },
events: [
  {
    name: 'exception',
    attributes: {
      'exception.type': 'Error',
      'exception.message': 'something broke',
      'exception.stacktrace': 'Error: something broke\n    at <anonymous> (.../src/index.ts:41:13) ...'
    },
    time: [ 1791563673, 548097666 ],
  }
],
```

- `status.code: 2` is the error status that `SpanStatusCode.ERROR` sets, with my message. The `exception` event holds the error type, the message and the stack trace. The first stack line points at `index.ts:41:13`, the `throw` in `/fail`. This is what `recordException` and `setStatus` did.
`GET /fail` span (the HTTP span from the automatic instrumentation), from `spans.log` line 1530 on:

```
attributes: { ..., 'http.response.status_code': 500, 'http.route': '/fail', ... },
status: { code: 2 },
events: [],
```

- The HTTP span also has `status.code: 2` (error), but with no message and no `exception` event. The automatic instrumentation took the error status from the 500 response. The error details (the `exception` event with the stack trace) are only on my `failWork` span, because I recorded them there.
- So without my own `recordException`, the trace would show that the request failed (500) but not why. I did not test that case (no `/fail` without `recordException`), so this last sentence is an inference from the two spans, not something I ran.

## What I learned (drafts from the output above, edit them)

- A trace is a tree of spans with a shared trace id. Here the automatic instrumentation made the HTTP and Express spans, and my own span attached itself under the handler span without any extra code.
- The span durations show where the time went: 95% or more of each `/hash` request was `slowLookup`. A log line saying "request took 205 ms" would not show that.
- My guess of 20% was far off, because I had not thought about how small the rest of the request is.

## Not measured / still open

- No collector, no UI, no metrics, no sampling (not part of today). The metrics exporter in `instrumentation.ts` was not used for anything.
- Five requests only, one `/fail` request. The spread of the extra 0.8 to 9.8 ms is not explained.
- I did not run `/fail` without my own `recordException`, so I do not know for certain what the trace would show then.

## Link

- https://opentelemetry.io/docs/languages/js/getting-started/nodejs/
