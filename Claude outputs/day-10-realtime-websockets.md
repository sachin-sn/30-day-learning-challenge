---
title: "Day 10 — The Test That Passed for the Wrong Reason"
date: "2026-10-01"
excerpt: "Broadcast and targeted delivery worked on the first real try. The heartbeat meant to catch a dead connection didn't — and it took waiting out the full timeout, not watching the first few pings, to notice."
tags: ["30-day-challenge", "day-10", "websockets", "ws", "nodejs", "real-time"]
draft: true
---

Days 7 through 9 all moved messages through something durable sitting
between producer and consumer — a broker or a managed queue, built
specifically to survive a consumer not being there right now. Day 10
removes that entirely. A WebSocket connection is either open or it
isn't, and a message sent into one that's gone just evaporates — no
dead-letter queue, no redelivery, nothing to replay from. That trade-off
turned out to be the easy part to understand. The hard part was a test
that looked like it passed when it hadn't actually tested anything.

![WebSocket broadcast, targeted delivery, and a heartbeat timing out an unresponsive client](day-10-realtime-websockets.gif)

## Broadcast, and a mistake that turned out to be useful

Three terminals, one server, one `create-todo` command typed into any
one of them — and the event landed in all three, including the one that
sent it. That part matched the prediction exactly.

The more interesting result came from a typo. Testing targeted delivery,
I addressed a direct message to `"A"` — the display name I'd typed when
launching that terminal — instead of the id the server had actually
assigned it on connect:

```
[server] direct message from 9c910396 targeted unknown/disconnected
client A — dropped
```

Nothing broke, nothing errored, nothing came back to tell me I'd gotten
it wrong. The message just didn't go anywhere, logged on a machine I
wasn't watching. That's a real property of the system, not a bug in my
test: the server only knows ids, and there's no protocol-level "that
address doesn't exist" acknowledgment. Re-addressed to the actual id, it
reached exactly the one client it was supposed to — the other two logs
stayed silent.

## A heartbeat that looked like it was working

Part 3 asks for something specific: a connection that's genuinely
indistinguishable from a live one at the TCP level, not a process that
visibly crashes. `kill -9` on localhost doesn't reliably produce that —
the OS tears the socket down almost immediately when a process on the
same machine dies, so the server usually sees a clean close right away.
The honest way to simulate it is a client that stays connected but stops
answering: override the `'ping'` handler, don't send a `pong` back.

First version did exactly that — removed the client's default `'ping'`
listener, logged instead of responding. Ran it, watched two pings arrive
in the logs, declared the heartbeat verified, and moved on.

It wasn't verified. `ws` responds to every incoming ping with a pong
**automatically, at the protocol level** — the `autoPong` option,
default `true` — completely independent of whatever `'ping'` event
listener the application code attaches. Removing my own listener did
nothing to the library's own auto-reply. The server kept receiving
pongs the whole time, `lastPong` kept resetting, and the 12-second
timeout had no chance to ever fire. The broken version and a correctly
working one look *identical* for the first several seconds — same
connection, same pings logged, same nothing-wrong-looking terminal
output. Only running it long enough to actually cross the timeout
window exposed that nothing was being tested at all.

The fix is one constructor option:

```ts
const ws = new WebSocket(url, { autoPong: false });
```

With that in place, the real run looked like this — two pings received
and ignored, then:

```
[server] client f3537c10 missed its heartbeat deadline —
terminating zombie connection
[server] client f3537c10 disconnected (code=1006 reason=, 3 remaining)
```

Z never sent a close frame. The server decided it was gone, based
entirely on silence past a deadline — which is the whole point of a
heartbeat, finally actually exercised instead of just assumed.

## One disconnection, two announcements

Watching the surviving clients' logs during that same test surfaced a
smaller, honest rough edge: all three logged **three** presence events
in a row for the one connection — `joined`, `timed-out`, `left`. The
heartbeat's termination branch broadcasts `"timed-out"` directly, and
then the socket's `close` handler fires right after — because a
`terminate()` call still triggers `close` — and broadcasts `"left"` for
the exact same disconnection. Not wrong, just redundant: a version of
this worth calling finished would track *why* a connection closed and
emit one event, not two.

## What today didn't have, and what it had instead

Lining this up against Days 7-9: there's no analog here for a committed
offset, a visibility timeout, or a replayable log, because none of those
exist without something durable sitting between sender and receiver —
and today deliberately has nothing in between. A message sent into a
dead connection isn't redelivered, isn't dead-lettered, isn't anything;
it's just gone. What Days 7-9 never gave me, on any platform tested, was
a way for the "broker" to speak first into an open connection without
something polling it — SNS, SQS, and Pub/Sub all wait to be asked.
Today's server pushes the instant something happens, to whichever
clients are actually there. Neither shape is strictly better than the
other; they're optimized for opposite failure modes, and picking one
means explicitly accepting what the other would have caught for free.

## What's next

Day 11 moves to gRPC — structured, strongly-typed service-to-service
calls instead of either a broker or a raw socket. Full code in the
[repo](#) — `day-10-realtime-websockets/`.
