# Day 7 — Kafka Fundamentals

**Difficulty:** Intermediate
**Tech stack:** Redpanda (Kafka-API compatible), Docker, TypeScript
**Estimated time:** 2-3 hours

## Why this matters

Every day so far has been request/response: a client asks, a server answers,
synchronously, in the same call. Kafka (and the event-streaming model in
general) is a different shape entirely — a producer publishes an event and
moves on, having no idea who's listening or when they'll read it. A
consumer reads at its own pace, independently, and can be offline entirely
when the event is produced without losing it. That decoupling is the whole
point, and it's also the thing that's hardest to *feel* until you've run a
producer and a consumer as two genuinely separate processes and watched one
outlive the other.

Docker's solid on your machine now after Day 4, so today runs Redpanda
locally — a single Kafka-API-compatible binary, much lighter than running
real Kafka plus Zookeeper for a learning exercise, and just as accurate for
today's purposes since it speaks the same protocol.

## A note on the Node.js Kafka client landscape, since it's more unsettled
than any library used so far in this series

`kafkajs` — the library most tutorials still point to — hasn't had a
release since February 2023 and isn't officially maintained. Confluent
shipped an official replacement, `@confluentinc/kafka-javascript`, built on
`librdkafka` (native bindings). That's the "correct" answer for a real
project today. It does not, however, reliably work under Bun yet — the
native bindings hit a gap in Bun's V8 C++ API support (open upstream as of
this writing). Two honest options for today:

- Stay on Bun, use `kafkajs`. It's pure JS (no native bindings, so no Bun
  compatibility problem), and the Kafka wire protocol it speaks hasn't
  changed in ways that break it. Fine for learning; not what you'd reach
  for in production.
- Switch to Node for today specifically, use `@confluentinc/kafka-javascript`.
  The officially-maintained, currently-correct choice — just not on Bun yet.

Either is a legitimate choice; pick one and say which (and why) in
`solution.md`. Don't spend today fighting Bun/native-binding errors if you
picked the first path and hit them anyway — that's the sign to switch.

## Learning objectives

By the end of today you should be able to:

- Run a local Kafka-compatible broker (Redpanda) via Docker
- Explain, concretely, the difference between a topic, a producer, and a
  consumer
- Publish and consume a message for real, with the producer and consumer
  running as two independent processes — not two functions called in the
  same script
- Explain what happens to a message if the consumer isn't running when it's
  produced, and demonstrate it rather than assuming it

## The challenge

**Part 1 — Get Redpanda running.** `docker compose up` with a single-broker
Redpanda setup (Kafka API on `localhost:19092`, optionally the Redpanda
Console on `:8080` for a UI into topics/messages — not required, but handy
for sanity-checking what you just did). Confirm it's actually up by
creating a topic before writing any app code — same principle as Day 5's
"create a table to prove the database is really there," applied to a topic
instead.

**Part 2 — Producer.** Write a small script that publishes a `todo.created`
event to a topic (e.g. `todos`) whenever a todo is created — reuse Day 2's
Zod schema (or a trivial variant) to validate the event payload before
publishing, same as every day since Day 3 has reused it for a request body.
This doesn't need to be wired into a real HTTP server; a script that
publishes one message when run is enough.

**Part 3 — Consumer.** Write a **separate** script — its own process,
started with its own `bun run`/`node` command in its own terminal — that
subscribes to the topic and logs every message it receives as it arrives.

**Part 4 — Prove the decoupling, not just the happy path.** Run the
consumer, then run the producer, and confirm the message shows up in the
consumer's terminal. Then do the more interesting version: stop the
consumer, run the producer twice while the consumer is down, and *then*
start the consumer again. Does it see the messages that were published
while it wasn't running? Capture what actually happens in `solution.md` —
don't predict it, run it.

### Requirements

- Redpanda genuinely running via Docker, with a real topic created and
  confirmed before app code
- Producer and consumer are two separate processes/terminals, not one
  script calling both a "produce" and "consume" function in sequence —
  that would prove nothing about the decoupling that's the whole point
  of today
- The event payload is validated with a reused/adapted Zod schema before
  being published
- The consumer-was-down scenario from Part 4 actually run and captured,
  not assumed

### Constraints

- Redpanda via Docker, not a hosted Kafka service — today's about the
  local mental model
- `kafkajs` on Bun, or `@confluentinc/kafka-javascript` on Node — pick one,
  say why in `solution.md`

## Bonus round (optional)

- Run two consumers in the *same* consumer group and watch what happens to
  message delivery between them (a preview of Day 8's deeper dive into
  consumer groups and partitioning — today's version is just "notice the
  behavior," not "explain the algorithm")
- Kill the consumer mid-processing (right after it logs a message but
  before it would move on) and restart it — does it reprocess that same
  message? This is the concrete, observable version of "at-least-once
  delivery," worth seeing once rather than only reading about
- Note one concrete tradeoff of pub/sub vs every previous day's
  request/response APIs — e.g. a producer gets no return value telling it
  whether the consumer succeeded, which is a very different failure model
  than a tRPC mutation or a GraphQL resolver throwing

## Resources

- https://docs.redpanda.com/current/get-started/quick-start/
- https://docs.redpanda.com/redpanda-labs/docker-compose/single-broker/
- https://kafka.js.org/docs/getting-started
- https://github.com/confluentinc/confluent-kafka-javascript

---

Once you've built something, write up `solution.md` in this folder using
`../_template/solution.md` as a starting point.
