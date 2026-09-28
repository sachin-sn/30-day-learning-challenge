# Day 7 — Solution: Kafka Fundamentals

**Blog post:** <link, once published>
**LinkedIn post:** <link, once shared>

## Approach

<TODO: your own words — why kafkajs on Node instead of the two suggested
combos (bun+kafkajs or node+confluent), what you tried first, what changed
along the way.>

Ran Redpanda + Redpanda Console via `docker-compose.yml` (single broker,
Kafka API on `localhost:19092`), confirmed it was up by creating the
`todos` topic with `rpk` through `docker exec` before writing any app code.
Producer and consumer are two separate scripts (`producer.ts` /
`consumer.ts`), each run as its own process in its own terminal via
`npm run produce` / `npm run consume` — never called from the same script,
so the decoupling in Part 4 is real rather than simulated.

## Key concepts learned

- A producer publishes and moves on — it has no idea whether or when a
  consumer reads the message. A consumer reads independently, at its own
  pace, and can be completely offline when a message is produced without
  losing it (as long as the topic still retains that message).
- Topic subscription is exact: a consumer only ever sees messages on the
  topic(s) it explicitly subscribed to. Publishing to a different topic
  (`DEMO`) while subscribed only to `todos` produced nothing in that
  consumer — confirmed directly rather than assumed.
- `fromBeginning: true` doesn't mean "replay everything, always" — it only
  takes effect when the consumer group has no durable committed offset yet.
  Once offsets are committed, a restart resumes from there instead.
- Replay + at-least-once delivery, seen firsthand rather than just read
  about: restarting the consumer after it hadn't cleanly committed offsets
  (killed instead of gracefully disconnected) replayed messages that had
  already been logged once, back to back — a live example of why
  "at-least-once" is the honest default, not "exactly-once."
- Pub/sub has a very different failure model than every previous day's
  request/response APIs: `producer.send()` resolves once the broker has
  the message, but the producer gets no signal at all about whether any
  consumer succeeded in processing it. A tRPC mutation or GraphQL resolver
  throwing tells the caller something failed; a Kafka producer has no
  equivalent feedback loop.

## Code walkthrough

- `src/node/producer.ts` — validates the todo event against a Zod schema
  (adapted from Day 2/3's, with `priority` as a lowercase `low|medium|high`
  literal) before publishing. `prod(todo, topic)` takes the topic as a
  parameter so the same function can target `todos` or a scratch topic
  (`DEMO`) for isolation testing.
- `src/node/consumer.ts` — subscribes to `todos` only, with `groupId:
  "todo-consumer"` and `fromBeginning: true`, and logs every message as it
  arrives via `eachMessage`.
- `src/node/docker-compose.yml` — single-broker Redpanda + Redpanda Console,
  Kafka API exposed on `19092`, Console on `8080` for a UI into topics and
  messages.

## Gotchas / things that tripped me up

- `Kafka` from `kafkajs` is a class, not a ready-made client —
  `Kafka.producer()` / `Kafka.consumer()` called directly on the import
  throws `Kafka.producer is not a function`. Needed `new Kafka({ brokers:
  [...] })` first, then `kafka.producer()` / `kafka.consumer({ groupId })`.
- `kafka.consumer()` requires a `groupId` — omitting it throws a config
  error before it ever connects.
- `producer.send()`'s `messages` array needs `{ value: string | Buffer }`
  items, not the raw parsed object — passing the todo object directly as
  the message (instead of `{ value: JSON.stringify(todo) }`) sends a
  message with no usable value.
- Running `.ts` files directly with `node` broke two different ways
  depending on what was missing: without `"type": "module"` in
  `package.json`, top-level `import`/`await` aren't legal in Node's default
  CommonJS mode; and Node 22.2 predates native TypeScript support entirely
  (that needs 22.6+ experimentally, 23.6+ by default), so plain `node
  producer.ts` couldn't run it either way. Installed `tsx` as a
  version-independent runner instead of chasing a Node upgrade.
- `tsx`'s `esbuild` dependency is a native binary — installing it in one
  environment (e.g. a remote/CI shell) and running it in another
  (Apple Silicon locally) fails with a clear but easy-to-misread
  "installed esbuild for another platform" error. Fix is a clean
  `rm -rf node_modules package-lock.json && npm install` on the machine
  that will actually run the code.
- A consumer process killed with Ctrl+C instead of shut down gracefully
  may not have committed its offsets yet — the next `fromBeginning: true`
  start replays messages that were already delivered once, which looks
  like a bug until you realize it's exactly what "at-least-once" means.

## What I'd do differently

<TODO: your own words — e.g. graceful shutdown (SIGINT handler calling
consumer.disconnect()) so offsets commit reliably; trying
@confluentinc/kafka-javascript on Node instead of kafkajs, since that's
the officially-maintained option; running the bonus round (two consumers
in the same group, or killing mid-`eachMessage` to watch reprocessing).>

## Further reading

- https://docs.redpanda.com/current/get-started/quick-start/
- https://kafka.js.org/docs/getting-started
- https://kafka.js.org/docs/consuming#a-name-from-beginning-a-fromBeginning
