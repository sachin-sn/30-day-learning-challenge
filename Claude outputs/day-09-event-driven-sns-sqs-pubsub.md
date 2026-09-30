---
title: "Day 9 — Two Clouds, Two False Alarms"
date: "2026-09-30"
excerpt: "Same fan-out and competing-consumer shapes as Kafka, reproduced on SNS/SQS and GCP Pub/Sub — and two results that looked broken until the mechanism underneath explained itself completely."
tags: ["30-day-challenge", "day-09", "aws", "sns", "sqs", "gcp", "pubsub", "event-driven"]
draft: true
---

Day 8 ended with a topic split into partitions and a consumer group
dividing them — a mechanism I ran myself, on a broker I stood up in
Docker. Day 9 asks the same two questions — does everyone get a copy, or
does exactly one of you get each message — on infrastructure I don't run
at all: SNS/SQS on AWS, Pub/Sub on GCP. Both platforms answered correctly
in the end. Both also produced a result that looked broken on first read,
for two completely different reasons, and both turned out to be the
system working exactly as designed once I stopped assuming and started
checking.

## One publish, two queues, two different types

The fan-out test used a FIFO SNS topic (`todo-events.fifo`) subscribed to
by two SQS queues on purpose — not two of the same kind, but one FIFO
queue and one standard queue. Older AWS documentation and a lot of
still-circulating advice says a FIFO topic can only fan out to FIFO
queues. One publish, one `MessageId`, two independent pulls later:

```
"TopicArn" : "arn:aws:sns:ap-south-1:...:todo-events.fifo"
"SubscriptionArn": "...1c20d277..."   → todo-events-q1.fifo
"SubscriptionArn": "...eabea6c9..."   → todo-event-q2 (standard)
```

Both queues had it, same message, same timestamp, independently
delivered. AWS quietly added standard-queue support as a valid FIFO-topic
subscriber at some point, and the "FIFO only" rule just never got
un-repeated. Worth a direct test any time a claim like that sounds like a
hard architectural wall — sometimes it's a wall that moved.

## Receiving isn't deleting

Competing consumers is the other half of the picture: one standard queue,
two terminals long-polling it at once. Sent a batch, and every message
landed in exactly one terminal — never both, never neither. That part
matched the prediction cleanly.

The more useful result came from doing it wrong on purpose. Received a
message in one terminal and didn't delete it. Thirty seconds later — past
the visibility timeout — it came back, available to be picked up by
whichever poller asked next:

```
"MessageId": "0c894473-...",
"Attributes": { "ApproximateReceiveCount": "3" }
```

Three receives, zero deletes, one message still sitting in the queue.
That's not SQS misbehaving — it's the entire mechanism that makes
at-least-once delivery safe: an unacknowledged message doesn't disappear,
it becomes available again. It's the same lesson Day 7's Kafka replay
taught with committed offsets, wearing different vocabulary: "the
producer sent it" and "a consumer safely finished with it" are never the
same guarantee, on any of these systems.

## An ordering guarantee that looked broken, and wasn't

The FIFO queue produced the day's best moment of "this looks wrong."
Pulling a batch off `todo-events-q1.fifo` came back in this order, by
message label: `2, 3, 4`, then the original SNS test message, then `1`.
On a queue whose entire selling point is first-in-first-out, that reads
like a bug immediately.

Pulling `MessageGroupId`, `SequenceNumber`, and `SentTimestamp` explained
it in one look. `"- 2"`, `"- 3"`, and `"- 4"` were each alone in their own
group — `MessageGroupId: "2"`, `"3"`, `"4"` — so there was never an
ordering relationship between them to break. FIFO's guarantee is scoped
to a group, not the whole queue, and a group of one has nothing to be out
of order relative to.

The one pair that actually shared a group told the real story. The
original SNS fan-out message and `"queue1 - 1"` had both landed, by
coincidence, in `MessageGroupId: "1"`. Their `SentTimestamp`s were 43
minutes apart, SNS message first. Their receive order: SNS message first.
Exact match. The queue wasn't broken — it was honoring a guarantee I'd
misread the scope of.

## The same test, a different cloud, its own near miss

GCP Pub/Sub got the identical fan-out test: one topic, two subscriptions,
publish once. First result looked worse than the SQS surprise —
`todo-event-sub` got 2 of the 3 published messages, `todo-event-sub-2`
got only 1, and repeat pulls with a generous `--limit` didn't change it.

Before assuming Pub/Sub's fan-out was simply less reliable than SNS's,
the config was worth ruling out directly: `gcloud pubsub subscriptions
describe` on both subscriptions came back identical in every field, no
`filter` set on either. So it wasn't selective delivery. What confirmed
the real cause was a clean re-test: publish one new message well after
both subscriptions had existed for a while, pull both immediately — both
subscriptions had it right away. The earlier gap was a subscription
freshly created a couple of seconds before messages started flowing,
still finishing its own registration with the topic's routing layer. Not
an ongoing bug, just a short window worth knowing about if a real system
ever publishes immediately after provisioning a subscription.

## One more gotcha, on both platforms

Cleaning up backlog on both queues after all this testing surfaced the
same mistake twice, once per platform. On GCP, trying to `ack` one
subscription's copy of a message using the *other* subscription's `ackId`
failed outright:

```
INVALID_ARGUMENT: You have passed a subscription that does not belong
to the given ack ID
```

SQS has the identical property under a different name — a
`ReceiptHandle` is scoped to one specific delivery, not to the message,
and goes stale the instant that message is redelivered. Two copies of
the same message, or two receives of the same message, look identical in
every field except the one that actually matters for cleaning up after
yourself.

## What's next

Day 10 moves to real-time delivery in the other direction — WebSockets,
where the server pushes without being asked, instead of a consumer
pulling on its own schedule. Full commands and raw CLI output in the
[repo](#) — `day-09-event-driven-sns-sqs-pubsub/`.
