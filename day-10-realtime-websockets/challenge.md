# Day 10 — Real-Time with WebSockets

**Difficulty:** Intermediate
**Tech stack:** WebSockets (`ws`), Node.js, TypeScript
**Estimated time:** 2-3 hours

## Why this matters

Days 7-9 all moved events through something durable sitting between
producer and consumer — a broker or a managed queue — which is exactly
why a consumer could disconnect for 30+ minutes and replay everything it
missed once it came back. A browser tab showing a live todo list can't
poll SQS or Pub/Sub directly, and polling a REST endpoint every few
seconds to fake "live" is wasteful and laggy. WebSockets solve the other
half of the real-time problem: a persistent, bidirectional connection
where the server can speak first, to one specific client, right now —
with none of the durability or replay semantics the last three days
leaned on. Today is about feeling that trade-off directly: no broker, no
redelivery, just a connection that is either open or it isn't.

## Learning objectives

By the end of today you should be able to:

- Stand up a plain WebSocket server that accepts multiple concurrent
  client connections
- Broadcast a message to every connected client, and target a message at
  one specific client, and explain the code-level difference between the
  two
- Observe what happens when a message is sent to a client that's already
  disconnected — no redelivery, no DLQ, nothing — and explain why that's
  fundamentally different from every delivery guarantee explored on Days
  7-9
- Implement a ping/pong heartbeat and use it to detect a connection that
  looks alive in your server's client list but never sent a proper close
  frame
- Compare WebSockets against Server-Sent Events and polling for the same
  "push a todo update to the browser" use case, and say when each is
  actually the right tool

## The challenge

**Part 1 — Broadcast.** Build a WS server and a minimal client (a
browser page or a second Node script both work) for the todo app from
earlier days. Whenever a todo is created, broadcast the event to every
currently connected client. Open 3 clients at once and confirm all three
receive every event.

**Part 2 — Targeted delivery and the disconnect test.** Assign each
client an id on connect. Send a message addressed to one specific client
id only, and confirm the others don't receive it. Then: open a client,
confirm it received a message, kill that client *ungracefully* (`kill
-9` the process, or just close the terminal — not a clean
`socket.close()`), send another message addressed to that same id, and
watch what the server actually does: does it throw, silently drop the
send, or something else? Write down your prediction before you run it.

**Part 3 — Detecting the zombie connection.** An ungracefully killed
client's TCP connection doesn't always deliver a close frame to the
server — the socket can sit in your server's client list looking
perfectly alive. Implement a ping/pong heartbeat (server pings every N
seconds, terminates any client that hasn't ponged within a timeout) and
demonstrate a connection that looks alive actually being dead until the
heartbeat catches and removes it.

**Part 4 — Map it back.** In `solution.md`, write down explicitly what
Days 7-9 gave you for free that plain WebSockets do not (durability,
replay, at-least-once delivery, decoupling a producer's lifetime from a
consumer's) — and what WebSockets give you that none of the previous
three did (the server initiating contact, with zero polling and zero
broker in between).

### Requirements

- A real multi-client broadcast test with 3 or more concurrent clients
- The ungraceful-disconnect scenario actually triggered and observed, not
  predicted and left there
- A working heartbeat that detects and removes a genuinely zombie
  connection

### Constraints

- Plain `ws` (or Node's lower-level primitives if you want to go further)
  — no Socket.IO, so the reconnection/room mechanics aren't hidden behind
  a framework abstraction
- TypeScript, same as every prior day

## Bonus round (optional)

- Add automatic client-side reconnect with exponential backoff, and
  notice what's still missing after reconnect that Kafka/SQS/Pub/Sub gave
  you automatically: anything broadcast while a client was disconnected
  is just gone, unless you build your own buffering/replay on top
- One sentence comparing this to Day 9's visibility-timeout/ack model:
  which specific failure mode from today (a message sent into a dead
  connection) does neither SQS nor Pub/Sub actually have, and why not

## Resources

- https://datatracker.ietf.org/doc/html/rfc6455
- https://github.com/websockets/ws
- https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API

---

Once you've built something, write up `solution.md` in this folder using
`../_template/solution.md` as a starting point.
