# Day 8 — Kafka Consumer Groups & Partitioning

**Difficulty:** Intermediate
**Tech stack:** Redpanda (Kafka-API compatible), Docker, TypeScript, kafkajs
**Estimated time:** 2-3 hours

## Why this matters

Day 7 proved the basic shape: a producer publishes, a consumer reads
independently, decoupled in time. What it didn't touch is *how* Kafka
scales that consumer side, and the answer is the single most-asked-about
Kafka interview topic for a reason — a topic is split into partitions,
and a consumer group divides those partitions among its members. Two
consumers in the same group don't both see every message the way two
independent groups would; they split the work. Today is about watching
that split happen, watching it *re*-split when a consumer dies, and
seeing exactly where Kafka's ordering guarantee actually applies (a
partition) versus where people wrongly assume it applies (the whole
topic).

You already saw the seed of today's topic in Day 7's own consumer
output, probably without clocking it: `memberAssignment: { todos: [0] }`
in the `Consumer has joined the group` log line. That array is a list of
partition numbers. Today's about making that array actually interesting.

## Learning objectives

By the end of today you should be able to:

- Explain what a partition is and why Kafka's ordering guarantee is
  per-partition, not per-topic
- Predict, and then confirm, which partition a keyed message lands on
- Run two consumers in the same consumer group and observe partitions
  being divided between them, not duplicated
- Trigger a rebalance on purpose (kill a consumer) and observe the
  survivor pick up the orphaned partition(s)
- Explain the difference between two consumers in one group (work
  splits) and two consumers in two different groups (both get
  everything) — the same primitive doing two different jobs depending on
  `groupId`

## The challenge

Reuse Day 7's Redpanda setup and `kafkajs` producer/consumer as your
starting point — same broker, same library, same `todoType` validation.
Everything below is additive.

**Part 1 — A topic with more than one partition.** Day 7's `todos`
topic was almost certainly created with the default single partition,
which makes consumer groups uninteresting (nothing to divide). Create a
fresh topic with multiple partitions before writing any app code, same
"prove it's really there" principle as every prior day:

```bash
docker exec -it redpanda-broker rpk topic create todos-v2 --partitions 3
docker exec -it redpanda-broker rpk topic describe todos-v2
```

Don't just add partitions to the existing `todos` topic — partition
count is chosen at creation time for a reason (more on that in Part 2),
and a clean topic keeps this exercise's results easy to reason about
against Day 7's.

**Part 2 — Send keyed messages.** Extend Day 7's producer to send a
Kafka message `key` (not just `value`) — kafkajs's `messages` array
accepts `{ key, value }`. Send a batch where several messages share the
same key (e.g. all todos for the same fake "owner id") and several use
different keys. Log which partition each one actually landed on (the
producer's `send()` resolves with per-message metadata that includes
it). Before you run it, write down your prediction for which messages
will share a partition — then check whether you were right.

**Part 3 — Two consumers, one group.** Run two instances of your
consumer script simultaneously, in two separate terminals, both using
the **same** `groupId`. Watch the join/rebalance logs in both terminals.
Confirm from the logs (not from guessing) that each partition is owned
by exactly one of the two consumers at a time — publish a batch of
messages across all partitions and check that every message is logged
by exactly one terminal, never both.

**Part 4 — Force a rebalance.** With both consumers still running from
Part 3, kill one of them (Ctrl+C). Watch the survivor's logs for a
rebalance and confirm it picks up the partition(s) the killed consumer
used to own. Publish a few more messages and confirm the survivor now
handles all of them alone. Then restart the second consumer and watch a
*second* rebalance split the partitions again. Capture the actual log
lines in `solution.md` — this is the same "run it, don't predict it"
principle as Day 7's Part 4.

### Requirements

- A topic with at least 3 partitions, created and confirmed before app
  code, same as every prior day's "prove the infra is real" step
- Producer sends an explicit `key` on at least some messages, and logs
  the resulting partition per message
- Two consumer processes really running simultaneously in the same
  consumer group — not simulated, not one process pretending to be two
- The Part 4 rebalance actually triggered and its logs captured, not
  assumed from documentation

### Constraints

- Same stack choice as Day 7 (kafkajs, whichever runtime you settled
  on) — no need to re-litigate that decision
- Everything still runs against the local Redpanda container from Day 7

## Bonus round (optional)

- Add a **second, differently-named** consumer group (e.g.
  `todo-consumer-analytics`) reading the same topic *at the same time*
  as Part 3's group. Confirm it receives every message independently —
  contrast this directly against Part 3, where messages were split, not
  duplicated, within a single group
- Send a burst of same-key messages fast enough to land back-to-back and
  confirm they come out of their partition in the same order they went
  in — the concrete version of "ordering is per-partition"
- Note what happens to a partition assignment when you add a *third*
  consumer to a group that only has 3 partitions — what does the extra
  consumer get?

## Resources

- https://docs.redpanda.com/current/develop/consumer-groups/
- https://kafka.js.org/docs/consuming#consumer-groups
- https://kafka.js.org/docs/producing#producing-messages (message keys)

---

Once you've built something, write up `solution.md` in this folder using
`../_template/solution.md` as a starting point.
