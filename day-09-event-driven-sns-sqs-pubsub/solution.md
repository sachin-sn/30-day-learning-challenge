# Day 9 — Solution: Event-Driven Architecture: SNS/SQS vs GCP Pub/Sub

## Approach

Rather than write SDK code first and debug through it, I drove Parts 1–3
directly against both platforms via the AWS and `gcloud` CLIs —
`aws sns publish`, `aws sqs receive-message`/`delete-message`,
`gcloud pubsub topics publish`, `gcloud pubsub subscriptions pull`/`ack` —
so any surprising result would be about the platform's actual behavior,
not about a bug in my own polling loop. For Part 1, instead of two SQS
queues of the same type, I deliberately subscribed one **FIFO** queue
(`todo-events-q1.fifo`) and one **standard** queue (`todo-event-q2`) to a
**FIFO** SNS topic (`todo-events.fifo`), specifically to test an older,
commonly-repeated claim that FIFO SNS topics can only fan out to FIFO SQS
queues. For Part 2, I ran two literal terminal windows polling the same
standard queue concurrently rather than two threads in one process, so
the "two independent consumers" claim was actually true, not simulated.
Part 3 mirrored the same fan-out structure on GCP: one topic
(`todo-event`), two subscriptions (`todo-event-sub`, `todo-event-sub-2`).

## Key concepts learned

- **A FIFO SNS topic can fan out to a standard SQS queue, not just FIFO
  queues.** Published one message to `todo-events.fifo` and both
  `todo-events-q1.fifo` and `todo-event-q2` received their own
  independent copy — same `MessageId` inside the SNS envelope, two
  different `SubscriptionArn`s. AWS added mixed-type support after the
  FIFO-only rule was true, and not every doc/blog post caught up — worth
  verifying directly rather than trusting a remembered architectural
  constraint.
- **"Received" and "deleted" are different events, and the gap between
  them is the whole safety mechanism.** Two terminals polling
  `todo-event-q2` split a batch of messages cleanly — no overlap, no
  message seen by both. But a message received and not explicitly
  deleted comes back after the visibility timeout (30s here) and gets
  handed to whichever consumer asks next. `ApproximateReceiveCount`
  climbing to `3` on one message, across three separate receives with no
  delete in between, made this directly observable rather than inferred
  — the same "producer success and consumer success are different
  guarantees" lesson from Day 7's Kafka work, wearing SQS's vocabulary.
- **FIFO ordering is guaranteed per `MessageGroupId`, not per queue.** A
  batch pull off `todo-events-q1.fifo` came back in an order that looked
  broken at first glance — labels `2, 3, 4, [SNS envelope], 1`. Pulling
  `MessageGroupId`/`SequenceNumber`/`SentTimestamp` explicitly showed
  why: every `queue1 - N` message except `"- 1"` was alone in its own
  singleton group, so there was never an ordering relationship between
  them to violate. The one pair that _did_ share a group (the original
  SNS test message and `"queue1 - 1"`, both in `MessageGroupId: "1"`)
  came back in exact chronological order relative to each other. Looked
  like a bug; was actually the ordering guarantee doing exactly what it
  promises, scoped exactly as documented.
- **A freshly created Pub/Sub subscription can miss messages published in
  the first moment or two after it's created.** Publishing 3 messages
  right after creating both subscriptions, `todo-event-sub` got 2 of 3
  and `todo-event-sub-2` got only 1 of 3 on the first pull — with no
  `filter` configured on either (confirmed via
  `gcloud pubsub subscriptions describe`, ruling that out directly rather
  than assuming). A fresh message published well after both subscriptions
  had time to register arrived on both immediately. Registration
  propagation lag, not a fan-out bug — but it means "publish immediately
  after creating a subscription" is a real gap to know about, not just a
  theoretical one.
- **An ack/receipt handle is scoped to one specific delivery, not to the
  message.** Tried to ack `todo-event-sub-2`'s copy of a message using
  `todo-event-sub`'s `ackId` for the same underlying message —
  `INVALID_ARGUMENT: You have passed a subscription that does not belong
to the given ack ID`. SQS's `ReceiptHandle` has the identical property:
  it goes stale the moment a message is redelivered, so a handle from an
  _earlier_ receive won't delete a message that's since been redelivered.
  Same underlying rule on both platforms, easy to trip on because the two
  copies (or two receives) look identical in every other field.

### Kafka → cloud primitive mapping (the Part 4 requirement)

| Kafka concept          | AWS (SNS + SQS)                                                                                                                                                   | GCP Pub/Sub                                                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Topic                  | SNS topic (fan-out) or a single SQS queue (work-sharing, no fan-out)                                                                                              | Pub/Sub topic                                                                                                                                                      |
| Partition              | No equivalent — ordering/parallelism inside a FIFO queue come from `MessageGroupId`, one ordered lane per group, not a fixed partition count                      | No equivalent — same idea via an ordering key, one ordered lane per key                                                                                            |
| Consumer group         | Not a first-class concept — fan-out is "one queue per group" (separate queues), work-sharing is "however many workers point at one queue," no group id to declare | Same shape — fan-out is "one subscription per group," work-sharing is "however many pull workers point at one subscription"                                        |
| Rebalance              | Doesn't exist — no ownership-handoff protocol. Unacked messages just time out (`VisibilityTimeout`) and become available to whichever poller asks next            | Doesn't exist either — same timeout-based release (`ackDeadlineSeconds`) instead of a reassignment protocol                                                        |
| Committed offset       | No equivalent — `DeleteMessage` discards the message entirely; there's no position to rewind to                                                                   | No equivalent — `ack` discards it too; same one-way door                                                                                                           |
| `fromBeginning` replay | Not available — SQS keeps no replayable log                                                                                                                       | Closest analog is `seek` to a timestamp, but only if the subscription was configured to retain acked messages — not default behavior, unlike Kafka's log retention |

The honest summary: the two _shapes_ (fan-out vs. work-sharing) map
cleanly onto both platforms. The _mechanism_ underneath — partition
ownership and rebalancing in Kafka vs. timeout-based visibility/ack in
SQS and Pub/Sub — doesn't, and that difference is exactly what explains
every finding above.

## Code walkthrough

No `src/` this time — Parts 1–3 were driven entirely through the AWS CLI
and `gcloud` CLI directly against real infrastructure (see the exact
commands referenced under Key Concepts and Gotchas), deliberately, to
isolate platform behavior from any bug in my own polling code. This is a
deviation from the challenge's stated TypeScript/SDK constraint — flagged
honestly in "What I'd do differently" below rather than glossed over.

## Gotchas / things that tripped me up

- A broken multi-line `gcloud` command (a line continuation split across
  a paste) left a literal `--project=my-project-1530065360314` file
  sitting in the repo root — a 0-byte artifact from the shell
  interpreting a flag as a filename. Harmless, but a good reminder that a
  bad paste in a terminal can silently create a file instead of erroring
  loudly.
- Reused an SQS `ReceiptHandle` from an _earlier_ receive to try to
  delete a message that had since been redelivered — the handle had gone
  stale, which would have silently targeted the wrong (or no) in-flight
  copy if not caught. Same class of mistake as the `ackId`
  cross-subscription error above, on the other platform.
- `gcloud pubsub subscriptions pull --limit=N` doesn't guarantee it
  returns all N available messages in one call, even when more exist — a
  couple of pulls came back with fewer messages than were actually
  sitting in the backlog, which looked like a delivery gap before a
  repeat pull cleared it up.

## What I'd do differently

<TODO: your own words — still owe Part 3's second half (two pull
subscribers competing on the _same_ Pub/Sub subscription — only the
fan-out half got tested); still owe the bonus round's Pub/Sub
ordering-key test (SQS FIFO's `MessageGroupId` ordering is confirmed, the
Pub/Sub equivalent isn't yet); should go back and write the actual
`@aws-sdk/client-sns` + `@aws-sdk/client-sqs` + `@google-cloud/pubsub`
TypeScript code the challenge asked for, since this round was CLI-only
exploration; clean up the stray `--project=...` file in the repo root.>

## Further reading

- https://docs.aws.amazon.com/sns/latest/dg/sns-sqs-as-subscriber.html
- https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html
- https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/FIFO-queues.html
- https://cloud.google.com/pubsub/docs/publisher
- https://cloud.google.com/pubsub/docs/ordering
