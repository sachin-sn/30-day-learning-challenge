Day 10 of the 30-day challenge: WebSockets. Broadcast and targeted delivery both worked on the first real try. The part that was supposed to catch a dead connection didn't — and the reason took actual waiting, not just watching, to find.

Days 7-9 all moved messages through something durable — Kafka, SNS/SQS, Pub/Sub — specifically built to survive a consumer not being there right now. WebSockets have none of that. A message sent into a closed connection just evaporates. No dead-letter queue, no redelivery, nothing to replay.

Testing that meant building a heartbeat: the server pings every client, and anyone who doesn't pong back within a timeout gets dropped — the mechanism that's supposed to catch a connection that's gone quiet without ever sending a proper close frame.

My first version of the test looked like it passed. Two pings logged, no errors, heartbeat "verified." It wasn't. The WebSocket library I'm using (`ws`) auto-responds to every incoming ping with a pong automatically, at the protocol level — completely independent of whatever event listener your own code attaches. I'd removed my listener and assumed that disabled the response. It didn't. The server kept getting pongs the whole time, and the timeout had no chance to ever fire.

The broken version and a correctly working one look identical for the first several seconds. Only running it long enough to actually cross the timeout window exposed that nothing was being tested at all.

Fixed with one constructor option (`autoPong: false`), and then the real result: two ignored pings, then the server logging a clean "missed its heartbeat deadline — terminating zombie connection."

A small bonus find along the way: watching that disconnect, every other client logged three presence events for one connection — joined, timed-out, left — not two. Redundant, not wrong, but a good example of how the obvious fix (handle the close event) can quietly double-count something that already happened somewhere else in the code.

Full writeup, real terminal output, and a short animation of the network calls on the blog: <link>

#30DayChallenge #WebSockets #NodeJS #RealTimeSystems #SoftwareEngineering #DistributedSystems
