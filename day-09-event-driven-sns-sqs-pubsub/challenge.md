# Day 9 — Event-Driven Architecture: SNS/SQS vs GCP Pub/Sub

**Difficulty:** Intermediate
**Tech stack:** AWS SNS, AWS SQS, GCP Pub/Sub, TypeScript
**Estimated time:** 2-3 hours

## Why this matters

Days 7-8 built the mental model with a broker you run yourself. Today's
about recognizing the same two shapes — fan-out (everyone gets a copy)
and work-sharing (exactly one of you gets each message) — inside managed
cloud services, where the vocabulary changes but the underlying problem
doesn't. AWS splits the two jobs across two services (SNS for fan-out,
SQS for the queue); GCP folds both into one (Pub/Sub topics and
subscriptions). Neither is "more correct" — they're different answers to
where the fan-out logic should live, and that tradeoff shows up
constantly in real architecture decisions and in interviews that ask
"when would you reach for SNS+SQS instead of a single SQS queue."

## Learning objectives

By the end of today you should be able to:

- Explain why SNS alone or SQS alone can't give you both fan-out and
  durable, poll-based delivery — and why AWS composes them together to
  get both
- Reproduce Day 8's "two different consumer groups both get everything"
  result using SNS fan-out to multiple SQS queues
- Reproduce Day 8's "one consumer group splits the work" result using
  multiple workers competing on a single SQS queue — and be able to
  explain why the mechanism is different (visibility timeout, not
  partition assignment) even though the outcome looks the same
- Do both of the above again on GCP Pub/Sub, where fan-out and
  competing-consumer delivery are both native to one service via
  subscriptions
- Compare what each platform's default delivery guarantee actually
  promises (hint: it's the same "at-least-once" honesty lesson from Day
  7, wearing a different name)

## The challenge

You'll need working credentials for both an AWS account and a GCP
project — `aws sts get-caller-identity` and `gcloud auth list` should
both return something real before you write any app code, same
"prove the infra is actually there" principle as every prior day.

**Part 1 — SNS fan-out to SQS.** Create one SNS topic (e.g.
`todo-events`) and two separate SQS queues. Subscribe both queues to the
topic. Publish a single message to the topic and confirm **both** queues
received their own independent copy — this is Day 8's
"two consumer groups, same topic" result, built from two AWS services
instead of one Kafka group mechanism.

**Part 2 — Competing consumers on one SQS queue.** Send a batch of
messages to a single SQS queue (no SNS involved this time). Run two
separate worker processes polling that same queue concurrently. Confirm
each message is picked up by exactly one worker — never both, never
zero. This is Day 8's "one consumer group splits the partitions" result,
except SQS has no partitions: a message becomes invisible to other
pollers the moment one worker receives it (`VisibilityTimeout`), and gets
deleted only once that worker explicitly acknowledges it. Write down
what you predict happens if a worker crashes *after* receiving a message
but *before* deleting it — then actually crash one and check.

**Part 3 — The same two shapes on GCP Pub/Sub.** Create one Pub/Sub
topic with two separate **subscriptions**. Publish a message and confirm
both subscriptions receive it independently (fan-out, no second service
needed this time — it's built into the one topic/subscription model).
Then create two pull subscribers on the *same* subscription and confirm
they compete for messages exactly like Part 2's SQS workers did.

**Part 4 — Map it back.** In `solution.md`, write the direct
correspondence between today's primitives and Days 7-8's Kafka concepts:
what plays the role of a topic, a partition, a consumer group, and a
rebalance, on each platform — and where the analogy breaks down (neither
SQS nor a plain Pub/Sub subscription gives you Kafka's per-key ordering
guarantee without extra configuration — that's the bonus round).

### Requirements

- A real SNS topic fanning out to two real SQS queues, confirmed with an
  actual publish, not assumed from the docs
- A real single-SQS-queue competing-consumer test with two concurrently
  running workers
- The crash-before-delete scenario from Part 2 actually triggered and
  observed, not predicted and left there
- The same fan-out and competing-consumer shapes reproduced on GCP
  Pub/Sub
- `solution.md`'s Kafka-to-cloud primitive mapping, written from what you
  actually observed today, not from the docs alone

### Constraints

- Stay inside both platforms' free tiers — this needs almost no message
  volume to prove the concepts, so keep queue/topic counts and message
  batches small
- Delete every SNS topic, SQS queue, and Pub/Sub topic/subscription you
  create once you're done, same cleanup discipline as any cloud exercise
- TypeScript, same as every prior day — `@aws-sdk/client-sns` +
  `@aws-sdk/client-sqs` for AWS, `@google-cloud/pubsub` for GCP

## Bonus round (optional)

- Recover Day 8's per-key ordering guarantee: try an SQS **FIFO** queue
  with a `MessageGroupId`, and a Pub/Sub subscription with an ordering
  key, and confirm messages sharing a key/group actually arrive in send
  order — same proof-by-running-it standard as Day 8's ordering burst
- Note exactly what "at-least-once" means in SQS/Pub/Sub vocabulary
  versus Kafka's: it's "the message wasn't deleted/acked in time," not
  "the offset wasn't committed" — same underlying honesty, different
  trigger
- One sentence on the operational tradeoff: zero infrastructure to run
  yourself here, versus Days 7-8's Docker container you had to keep
  alive and reason about — where does that tradeoff actually matter in
  a real system you'd own?

## Resources

- https://docs.aws.amazon.com/sns/latest/dg/sns-sqs-as-subscriber.html
- https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html
- https://cloud.google.com/pubsub/docs/publisher
- https://cloud.google.com/pubsub/docs/ordering

---

Once you've built something, write up `solution.md` in this folder using
`../_template/solution.md` as a starting point.
