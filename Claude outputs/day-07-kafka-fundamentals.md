---
title: "Day 7 — Kafka Was the Easy Part"
date: "2026-09-28"
excerpt: "Redpanda, kafkajs, and a producer/consumer split across two real terminals. The messaging model behaved exactly as advertised — everything that broke was the road to running it at all."
tags: ["30-day-challenge", "day-07", "kafka", "redpanda", "kafkajs", "docker"]
draft: true
---

Every day so far has been request/response — a client asks, something
answers, synchronously, in the same call. Day 7 was the first genuinely
different shape: a producer publishes an event and walks away, with no
idea who's listening or when they'll read it. Redpanda (Kafka-API
compatible, one Docker container instead of Kafka plus Zookeeper) made
that easy to stand up. Actually running a producer and a consumer as two
independent processes was where the day's real bugs turned out to live —
and almost none of them were about Kafka.

## `Kafka` is a class, not a client

```ts
const { Kafka } = require("kafkajs");
const producer = Kafka.producer();
```

```
Kafka.producer is not a function
```

`Kafka` is a constructor. `producer`/`consumer` live on its instances, not
on the import itself:

```ts
const kafka = new Kafka({ brokers: ["localhost:19092"] });
const producer = kafka.producer();
```

Once that clicked, the next omission was obvious in hindsight: no
`brokers` config existed anywhere, because there was no `Kafka` instance
to hold one.

## A consumer needs to say which group it's in

```
KafkaJSError: Invalid consumer group configuration: groupId must be a valid string
```

`kafka.consumer()` with no arguments throws before it ever connects —
`groupId` is required, not optional. `todo-consumer` fixed it. This one
matters more than it looks: the group is also what determines whether a
restart replays history or resumes where it left off, which is exactly
what Part 4 of today's challenge turned out to hinge on.

## `producer.send()` wants a value, not an object

```ts
await producer.send({
  topic: TOPIC,
  messages: [message.data], // { id, title, priority }
});
```

kafkajs's `Message` type is `{ value: Buffer | string | null, ... }`.
Handing it the parsed todo directly gives it a message with no `value` at
all. The fix is one property, not a rewrite:

```ts
messages: [{ value: JSON.stringify(message.data) }],
```

Zod reused from Day 2's schema, same as every day since — `priority`
still needed the trim-before-min treatment from Day 6 to keep whitespace
titles from sneaking through.

## Two processes, and the module system had opinions about both

The challenge is explicit that producer and consumer have to be separate
terminals, not one script calling both functions in sequence — otherwise
Part 4's decoupling test proves nothing. Getting each script to run *at
all* on its own turned out to be its own small saga:

- `node producer.ts` with no `"type": "module"` in `package.json`:
  `SyntaxError: Cannot use import statement outside a module`. Node
  defaults `.ts` to CommonJS, where top-level `import` isn't legal.
- Node 22.2 (what I actually had installed) predates native TypeScript
  support outright — that landed experimentally in 22.6, unflagged in
  23.6+. So even fixing the module type wouldn't have been enough; there
  was nothing to strip the type annotations. `tsx` sidesteps the whole
  question — it works the same regardless of Node version.
- Adding `await prod();` / `await cons();` as top-level calls (so running
  the file actually *does* something) then hit `Top-level await is
  currently not supported with the "cjs" output format` — `tsx` was still
  transpiling to CJS because `package.json` had no `"type": "module"`.
  Adding that fixed it for real.
- Along the way, installing `tsx` from the wrong machine (a remote shell,
  not the Mac that would run it) pulled in `@esbuild/aix-ppc64` instead of
  `@esbuild/darwin-arm64` — esbuild ships a native binary per platform,
  and `node_modules` doesn't travel between architectures. `rm -rf
  node_modules package-lock.json && npm install`, run on the machine that
  actually executes the code, fixed it.

None of this is a Kafka problem. All of it had to be solved before Kafka
could even become the interesting part of the day.

## Proving the decoupling — including the part I didn't plan

With both scripts finally running as separate processes, the core
behavior showed up exactly as expected: start the consumer, run the
producer, watch the message land in the other terminal.

The more interesting result was unplanned. After adding a second topic
(`DEMO`) to test isolation, and re-running the producer, the consumer —
still subscribed only to `todos` — logged the three `todos` messages
*twice*, and the `DEMO` message not at all:

```
{ topic: 'todos', partition: 0, value: { id: 1, title: 'Eat', priority: 'medium' } }
{ topic: 'todos', partition: 0, value: { id: 2, title: 'Sleep', priority: 'high' } }
{ topic: 'todos', partition: 0, value: { id: 3, title: 'repeat', priority: 'low' } }
{ topic: 'todos', partition: 0, value: { id: 1, title: 'Eat', priority: 'medium' } }
{ topic: 'todos', partition: 0, value: { id: 2, title: 'Sleep', priority: 'high' } }
{ topic: 'todos', partition: 0, value: { id: 3, title: 'repeat', priority: 'low' } }
```

The `DEMO` silence is topic isolation working correctly — a consumer only
ever sees the topic it subscribed to. The doubled `todos` messages are
`fromBeginning: true` doing exactly what it's documented to do, just not
what I expected: it only replays from the start when the consumer group
has *no committed offset yet*. My earlier consumer session had been
killed with Ctrl+C rather than shut down gracefully, so `todo-consumer`
had nothing durably committed — the next start replayed the entire
topic, including messages already delivered once. That's not a bug, it's
at-least-once delivery, live: a producer's `send()` resolving tells you
the broker has the message, and says nothing about whether, or how many
times, a consumer will actually process it.

## What's next

Day 8 goes one level deeper into the mechanism that made today's replay
happen: consumer groups and partitioning — what actually happens when two
consumers share one group. Full code in the
[repo](#) — `day-07-kafka-fundamentals/`.
