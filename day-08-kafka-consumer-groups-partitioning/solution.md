# Day 8 — Solution: Kafka Consumer Groups & Partitioning

**Blog post:** <link, once published>
**LinkedIn post:** <link, once shared>

## Approach

Reused Day 7's Redpanda broker and `kafkajs` client rather than
rebuilding anything. Created a fresh `todos-v2` topic with 3 partitions
(`rpk topic create todos-v2 --partitions 3`) instead of reusing Day 7's
single-partition `todos`, so there was actually something for a
consumer group to divide. Extended the producer to send a batch of
`{ key, value }` messages per run and extended the consumer to accept
its `groupId` via a `GROUP_ID` env var, so the same script could spin up
either a second member of `todo-consumer-v2` or an entirely separate
group (`todo-consumer-analytics`) without duplicating files.

## Key concepts learned

- Kafka's ordering guarantee is **per partition**, not per topic —
  demonstrated directly, not assumed: 8 messages sent in one batch, all
  under the same key, arrived at the consuming end in the exact same
  order they were sent, because a single key always resolves to a single
  partition (`kafkajs`'s default partitioner: `murmur2(key) %
numPartitions`).
- That same hash function is deterministic but **not automatically
  well-distributed** with a small number of distinct keys. With 3
  partitions and 5 keys, `Bane`/`Jocker` both hashed to partition 0 and
  `Penguin`/`Riddler` both hashed to partition 1 — verified by running
  the exact partitioner function against the exact keys, not guessed.
  Looked like a broken consumer at first; was actually just hash
  arithmetic with too few distinct keys to average out.
- A consumer group divides a topic's partitions among its **currently
  live** members, and a partition is owned by exactly one member at a
  time — confirmed across 2, 3, and 4 concurrent consumers on the same
  `groupId`, by reading `memberAssignment` off the join logs rather than
  inferring it from behavior.
- Membership changes trigger a rebalance automatically — killing a
  consumer produces `"the group is rebalancing, so a rejoin is needed"`
  on the survivors' heartbeats, and the surviving member's next join log
  shows it absorbing the orphaned partition(s). Restarting the killed
  consumer triggers a second rebalance that hands partitions back.
- Oversubscribing a group (more consumers than partitions) doesn't
  error — the 4th consumer against 3 partitions joined successfully with
  `"memberAssignment":{}"`, a genuinely empty object (kafkajs omits the
  topic key entirely rather than showing an empty array). It sits
  connected and idle, ready to pick up a partition the moment one frees
  up.
- The same `groupId` mechanism does two different jobs depending on
  whether it matches: two consumers **sharing** a `groupId` split the
  work (queue semantics); two consumers in **different** groups both get
  every message independently (pub/sub semantics). Verified by running
  `todo-consumer-analytics` alongside `todo-consumer-v2` against the same
  topic at the same time — the analytics group logged every key across
  every partition while the other group kept splitting.

## Code walkthrough

- `node/producer.ts` — sends a batch of `{ key, value, partition? }`
  messages per run; `partition` is only set explicitly for two keys, and
  everything else is left to the default partitioner.
- `node/consumer.ts` — `groupId` now reads from `process.env.GROUP_ID`,
  falling back to `"todo-consumer-v2"`, which is what made the fan-out
  bonus test possible without a second file.
- `node/docker-compose.yml` — identical single-broker Redpanda setup
  from Day 7; nothing about the broker itself needed to change for
  partitioning or consumer groups.

## Gotchas / things that tripped me up

- `Math.floor(Math.random() * 4)` against a 5-element `keys` array meant
  index 4 (`"Two-Face"`) could mathematically never be picked — same bug
  shape on `Math.random() * 7` against an 8-element `values` array. Both
  needed `.length` instead of a hardcoded number. Easy to miss because
  the code runs fine and just quietly never exercises one branch.
- An explicit `partition: 1` / `partition: 2` override sat _above_ an
  unconditional `messages.push(...)` that ran regardless — so any time
  the random key landed on `"Riddler"` or `"Two-Face"`, it got pushed
  twice: once forced, once through the normal path. Looked like a Kafka
  duplication bug; was actually the loop just sending the same message
  twice.
- The single most confusing moment of the day: two consumer terminals
  showing the _exact same_ full message history. That's not what a
  working consumer-group split produces — a partition can only be owned
  by one member of a group at a time, concurrently. What actually
  happened was two **sequential** full replays: the first consumer had
  been stopped with Ctrl+C without committing its offset (same Day 7
  lesson, showing up again here), so when the second one later became
  sole owner of that partition, it replayed everything from scratch.
  Identical output across terminals is the signature of "not actually
  concurrent," not "partitioning is broken."
- Validation got commented out in the final producer (`// Skipping
validation for time being`) while chasing the partitioning bugs above.
  Worth flagging honestly rather than pretending it's still wired up —
  it should go back in before this is "done."

## What I'd do differently

<TODO: your own words — e.g. restore the Zod validation that got
commented out; pick a fixed, known-to-spread set of keys instead of
random selection when the goal is demonstrating partition distribution,
rather than relying on hash luck; add a graceful SIGINT handler so
offsets commit reliably and stop producing "is this actually a replay or
a bug" confusion.>

## Further reading

- https://docs.redpanda.com/current/develop/consumer-groups/
- https://kafka.js.org/docs/consuming#consumer-groups
- https://kafka.js.org/docs/producing#producing-messages
