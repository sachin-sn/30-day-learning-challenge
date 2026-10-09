# Day 18 — Observability with OpenTelemetry

**Time box:** 90 minutes. Part A about 40 min, Part B about 30 min, notes about 15 min.
If a part runs over by 15 minutes, stop, write down where you stopped, and move on.
**Tech stack:** Node.js 22, TypeScript, OpenTelemetry JS SDK (console output only)

## Why this matters

When a request is slow in production, logs tell you that it was slow and a trace
tells you where. "What is a trace, what is a span, and how does the context pass
between services" is a common interview question, and it is easy to answer well
once you have read a real trace once.

## Predictions (write these first, 5 min)

Put them in `solution.md` before you write any code.

1. For one `GET /hash?input=abc` to a plain Node HTTP server with the automatic
   instrumentation only, how many spans will be printed?
2. In Part B you add a function that waits about 200 ms inside the request. What
   percent of the whole request time will that function's span be?

## Part A — Build it (about 40 min)

In `src/`, make a small Node HTTP server (you can reuse the Day 17 `server.ts` and
the `/hash` route). Add OpenTelemetry so that every request prints its spans to the
console.

Done looks like: you call `curl "localhost:8080/hash?input=abc"` and the server
console prints at least one span with a name, a duration, a trace id and a span id.

Notes:

- Use the Node.js "getting started" page of the OpenTelemetry JS docs:
  https://opentelemetry.io/docs/languages/js/getting-started/nodejs/
- Use the `ConsoleSpanExporter`, so you do not need a collector or a UI.
- The setup file must load **before** your server code imports `node:http`, or the
  HTTP spans do not appear. Find out how the docs load it (for example with
  `--import`), and write one line in `solution.md` about what happened when you got
  it wrong or right.

## Part B — Measure or break it (about 30 min)

1. Add one function `slowLookup()` that waits a random 100 to 300 ms and call it in
   `/hash`. Wrap it in your own span with the name `slowLookup`.
2. Send 5 requests. For each, find the `slowLookup` span and the HTTP span of the same
   request (they share a trace id). Write the two durations in a table.
3. Add `GET /fail` that throws an error. Record the error on the span and set the span
   status. Call it once and find the error in the output.

## Save this output

- The span output of one `/hash` request, trimmed to name, trace id, parent id and duration
- Your table: 5 requests, `slowLookup` duration, HTTP span duration, share in percent
- The span output of the `/fail` request, trimmed

## Not part of today

A collector, Jaeger or Grafana, metrics, logs, sampling settings, and exporting to a
cloud service. They are good next steps. They will take the whole day.

## Resources

- https://opentelemetry.io/docs/concepts/signals/traces/
- https://opentelemetry.io/docs/languages/js/getting-started/nodejs/
