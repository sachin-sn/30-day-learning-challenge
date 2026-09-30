Day 9 of the 30-day challenge: same messaging pattern, tested on two different clouds — and it broke my assumptions twice, in two completely different ways.

Testing SNS → SQS fan-out, I found AWS quietly disproved something I'd taken as a hard rule: a FIFO SNS topic isn't restricted to FIFO SQS subscribers. I subscribed one FIFO queue and one standard queue to the same FIFO topic on purpose — both received their own independent copy of the message. Older docs (and a lot of still-circulating advice) say that can't happen.

Then on competing consumers: two terminals polling one SQS queue split incoming messages cleanly — until I deliberately left a message un-deleted and watched it get redelivered to a different worker after the visibility timeout expired. "Received" and "safely processed" are not the same guarantee, and SQS makes you feel that gap directly instead of hiding it.

Ran the identical two tests on GCP Pub/Sub. Fan-out looked broken at first — one subscription missed 2 of 3 messages published right after I created it — until it turned out to be a brief registration-propagation window right after subscription creation, not a bug. A message sent a few minutes later landed on both subscriptions immediately.

Neither cloud is doing this "wrong." Both get to the same fan-out and work-sharing behavior Kafka gives you, through a completely different mechanism — no partitions, no consumer groups, no rebalancing. Just timeout-based visibility and acknowledgment, scoped per delivery, not per message.

Full writeup with real terminal output (not sanitized, not summarized) on the blog: <link>

#30DayChallenge #AWS #GCP #SNS #SQS #PubSub #EventDrivenArchitecture #CloudArchitecture #SoftwareEngineering
