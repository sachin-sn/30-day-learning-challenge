---
title: "Day 8 — The Bug That Wasn't a Bug"
date: "2026-09-29"
excerpt: "Two consumers, one group, three partitions — and a producer whose random key selection turned out to be the real lesson of the day, twice over."
tags: ["30-day-challenge", "day-08", "kafka", "redpanda", "kafkajs", "consumer-groups"]
draft: true
---

Day 7 proved the basic shape: producer publishes, consumer reads,
decoupled. What it didn't touch is how Kafka scales the consumer side —
a topic split into partitions, a consumer group dividing those
partitions among its members. Today was about watching that division
happen, watching it *re*-divide when a consumer dies, and — mostly by
accident — learning that the thing that looks most like a bug in this
setup is usually just arithmetic.

## Second consumer, first mystery

Two consumers, same `groupId`, a fresh 3-partition topic. Consumer 1
logged everything. Consumer 2 logged nothing at all. Every instinct says
broken consumer group.

It wasn't. `kafkajs`'s default partitioner sends a keyed message to
`murmur2(key) % numPartitions` — deterministic, always the same
partition for the same key. I'd been testing with two keys, `Bane` and
`Jocker`. I ran both through the actual partitioner function:

```
Bane   -> partition 0
Jocker -> partition 0
```

Both keys hashed to the same partition. Every message, regardless of
which of the two keys it used, went to partition 0 — a roughly 1-in-9
coincidence with 2 keys and 3 partitions, not a bug. Consumer 2 had been
correctly assigned partition 1; there was simply nothing produced there
for it to receive. The rebalance, the assignment, the group protocol —
all of it was working. The keys just weren't spread out enough to prove
it.

## The bug that actually was a bug

Swapping in keys that hash to different partitions surfaced a real one.
The random-selection loop:

```ts
const ui = Math.floor(Math.random() * 4);   // keys.length is 5
const mi = Math.floor(Math.random() * 7);   // values.length is 8
```

`* 4` against a 5-element array means index 4 — `"Two-Face"` — can
mathematically never come up. Same shape on `* 7` against 8 values. Both
should have read `.length`. Nothing crashes when this happens, which is
exactly why it's the kind of bug that survives — one key in the array
just quietly never gets exercised, and everything still looks like it's
working.

Sitting right above that, a second issue: an explicit `partition: 1`
override for `"Riddler"` sat above an *unconditional* push that ran on
every iteration regardless. Every time the random key landed on
`"Riddler"`, it got sent twice — once forced, once through the normal
path. In the logs that shows up as the same message appearing back to
back, which reads exactly like a duplicate-delivery bug and isn't one.

## The identical-logs mystery

The strangest moment of the day: two consumer terminals showing the
*exact same* sequence of messages, in the exact same order, down to
every value. That's structurally impossible for a real concurrent
split — a partition can only be owned by one group member at a time, so
two consumers can't both legitimately replay its full history while
both are actively part of the group.

They weren't concurrent. The first consumer had been stopped with
Ctrl+C without committing its offset — Day 7's exact lesson, showing up
again in a completely different context. When the second consumer later
became the sole owner of that partition, `fromBeginning: true` replayed
everything from scratch, because there was no committed offset telling
it otherwise. Identical output across two terminals turned out to be the
signature of "these ran one after another," not "partitioning is
broken."

## What a correct split actually looks like

Once the key set was fixed and both consumers were genuinely running at
the same time, the logs told a clean, boring, correct story — which is
exactly what you want:

```
Consumer 1 — memberAssignment: { "todos-v2": [1] }   → Penguin, Riddler
Consumer 2 — memberAssignment: { "todos-v2": [0,2] }  → Jocker, Bane, Two-Face
```

No overlap. Killing consumer 2 triggered `"the group is rebalancing"` on
consumer 1's heartbeat, and its next join log showed
`memberAssignment: [0,1,2]` — it had absorbed both orphaned partitions
and started successfully logging messages from partitions it never used
to own. Restarting consumer 2 triggered a second rebalance, splitting
things back down.

## Two more things worth seeing, not just reading about

A **second, differently-named** consumer group (`todo-consumer-analytics`)
run against the same topic at the same time as the first received
*every* message independently — the same primitive doing queue-style
division of work within one group, and pub/sub-style fan-out across two
different ones, depending only on whether `groupId` matches.

And a **fourth** consumer added to a group with only 3 partitions joined
successfully with `"memberAssignment":{}"` — not an error, not a
rejection, just an idle member sitting in the group, ready to pick up a
partition the moment one frees up. Oversubscription doesn't break
anything; it just leaves someone waiting.

## What's next

Day 9 moves up a level: event-driven architecture with SNS/SQS and GCP
Pub/Sub — the managed-cloud version of today's decoupling, minus running
your own broker. Full code in the
[repo](#) — `day-08-kafka-consumer-groups-partitioning/`.
