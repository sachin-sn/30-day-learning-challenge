---
title: "Day 11 — The Other Side Never Found Out"
date: "2026-10-02"
excerpt: "One contract, three RPC shapes — unary, server-streaming, bidirectional. The shape that looks most like Day 10's WebSocket is also the one that broke my own prediction: killing one peer mid-exchange produced no error on the other side, because there was no other side to begin with."
tags: ["30-day-challenge", "day-11", "grpc", "protobuf", "typescript", "nodejs"]
draft: true
---

Day 3 was a typed contract for calls a browser makes (tRPC). Day 10 was a
raw, connection-oriented channel with no contract at all (WebSockets).
Day 11 sits in between: a typed contract, like Day 3, but built for
service-to-service traffic, with streaming as a first-class part of the
contract instead of something bolted on afterward. One `.proto` file, one
service, three RPCs — one of each shape gRPC supports. The point wasn't
building three separate things; it was comparing three shapes of the
*same* conversation against each other, and against the last two weeks.

## Three shapes, one contract

```protobuf
service TodoService {
  rpc CreateTodo (CreateTodoRequest) returns (Todo);
  rpc WatchTodos (WatchRequest) returns (stream Todo);
  rpc SyncTodos (stream TodoEvent) returns (stream TodoEvent);
}
```

`CreateTodo` is unary — one request, one response, done. It's
structurally identical to a tRPC mutation or an Express POST handler;
gRPC only changes the wire format and adds a generated contract neither
of those have. Four calls, four todos, no surprises:

```
[server] CreateTodo -> #1 "buy"
[server] CreateTodo -> #2 "buy Ducati scrambler"
[server] CreateTodo -> #3 "buy Ducati multistrada v2"
[server] CreateTodo -> #4 "buy Ducati multistrada v2s"
```

(Hard to write a todo-app example without it turning into a bike
shopping list.)

`WatchTodos` and `SyncTodos` are where it stops looking like Day 3 and
starts looking like Day 10 — and where the actual lesson of today showed
up.

## No backlog, confirmed twice

`WatchTodos` is server-streaming: the client calls it once, and the
server pushes as many `Todo` messages back as it wants, for as long as
the client keeps the call open. The mechanism behind it is almost
embarrassingly simple — every open `WatchTodos` call sits in an array on
the server, and `CreateTodo` just writes the new todo into every entry in
that array. One unary call reaching into a completely unrelated stream
and waking it up.

The question worth asking before running it: does a watcher that joins
*after* some todos already exist get the backlog, or only what happens
from that point forward? Opened one watcher after `#1` and `#2` already
existed:

```
[watcher] watching for new todos...
[watcher] received #3 "buy Ducati multistrada v2"
[watcher] received #4 "buy Ducati multistrada v2s"
```

Never saw `#1` or `#2`. Opened a second watcher even later, after `#3`
existed too — it received only `#4`. No backlog, no "join and catch up."
The stream's entire existence is tied to the call being open right now;
there's no stored history anywhere for a late joiner to replay. That's
the real difference from a WebSocket hub that could, in principle, be
built to replay history to a new connection — this can't, structurally,
because nothing is retained once it's pushed out.

## The kill test that broke my own prediction

`SyncTodos` is bidirectional streaming, and it's the one that actually
*looks* like Day 10's full-duplex socket in code — readable and writable
at once, neither side waiting on the other. Ran two of them, `A` and
`B`, concurrently, each on its own 1.5-second send timer, completely
unsynchronized:

```
[A] -> 15:20:53.944 "A-msg-1"
[A] <- 15:20:53.952 "ack: A-msg-1" (from server)
...
[B] -> 15:21:10.096 "B-msg-1"
[B] <- 15:21:10.099 "ack: B-msg-1" (from server)
```

`B` started 17 seconds after `A` and never once referenced it. Both ran
for minutes, every round trip under 10 milliseconds.

Going into the kill test, my prediction was straightforward: kill one
peer mid-exchange, and "the other side" gets some kind of error — the
direct parallel to Day 10's dead-connection detection. So I killed `A`
with `kill -9` while both were mid-exchange — `A`'s last message was
`A-msg-143`, `B` was on `B-msg-133` at that exact moment:

```
[server] SyncTodos <- "A-msg-143" (from A)
[server] SyncTodos <- "B-msg-133" (from B)
[server] SyncTodos -> peer closed its send side, closing ours too
```

`B` never noticed. It kept sending and getting acked on its own schedule
— `B-msg-134`, `135`, `136` — straight through `A`'s death and for
minutes afterward, with zero disruption.

My prediction was wrong because the premise was wrong: there is no
"other side" in the sense I meant it. Each `SyncTodos` call is a private
stream between one client and the server — never client-to-client. `A`
and `B` were never connected to each other at all; they just happened to
both be talking to the same process. The only place the failure showed
up was in the server's log for that one specific connection. It's the
same shape of lesson Day 10 kept running into with `kill -9` on
localhost: the thing you're trying to simulate (a slow, silent death) and
the thing you actually get (a fast, clean close, visible to exactly the
process that was watching for it) aren't the same, and running it instead
of reasoning about it is the only way to find out which one you actually
have.

## A field removed, caught before it ran

The last piece was quieter but just as concrete. Deleted `title` from
the `Todo` message in the `.proto`, regenerated the TypeScript stubs, and
tried to compile — no application code touched, only the contract. The
compiler rejected every file that still referenced `.title` on a `Todo`,
before any of it ran. Day 1's equivalent mistake — dropping a field from
a hand-written JSON response — would have shipped silently and shown up
as `undefined` at runtime, found only by whoever happened to log the
right value. Here it's a build failure, which is a strictly better place
for that mistake to live.

## What today didn't have, and what it had instead

Day 10 had a raw socket and no contract. Day 11 has a contract and three
precisely-shaped calls, but every one of them is still fundamentally a
*call your own client made and is still holding open* — there's no
server-initiated push into a connection nobody asked for, and (the real
surprise) no notion of "the other participant" even when two clients are
both streaming through the same method at the same time. gRPC's shapes
map cleanly onto "no stream," "server talks more," and "both talk
whenever" — but "both talk whenever" still only describes you and the
server, never you and whoever else is also connected. That distinction
was invisible through every normal exchange and only showed up once
something was deliberately killed and nothing happened to the peer that
should, by my own prediction, have noticed.

## What's next

Day 12 moves to rate limiting algorithms, built from scratch instead of
reached for off a shelf — token bucket, sliding window, the actual
arithmetic behind the `429` every API eventually returns. Full code in
the [repo](#) — `day-11-grpc-service-to-service/`.
