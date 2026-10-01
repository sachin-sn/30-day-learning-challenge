# Day 10 — Solution: Real-Time with WebSockets

**Blog post:** <link, once published>
**LinkedIn post:** <link, once shared>

## Approach

Built the server to track clients in a `Map<string, ClientRecord>` keyed
by a server-generated id (not the human-readable label typed when
launching a terminal), deliberately — that distinction is what makes
Part 2's "sending to an id you don't actually have" case reachable
without engineering it on purpose. Used a stdin-driven CLI client
(`client.ts`) so three concurrent connections for Part 1 were three real
terminals, not three threads faking it, plus a zero-build `public/`
HTML page as an alternative (open it in three tabs instead). Implemented
the ping/pong heartbeat from the start, since Part 3 explicitly asks for
a connection that's genuinely undetectable as dead, not a process that
visibly crashed.

## Key concepts learned

- **Broadcast confirmed cleanly across three real terminals.** Every
  `create-todo` reached all three clients regardless of who sent it —
  including the sender itself, since `broadcast()` doesn't exclude the
  originating connection.
- **The human label and the server id are not the same thing, and mixing
  them up is a real trap, not a hypothetical one.** Addressing a direct
  message to `"A"` (the terminal's own display name) instead of the
  server-assigned id the server actually tracks produced a clean, silent
  drop — logged server-side as `targeted unknown/disconnected client A —
  dropped`, with nothing sent back to the sender. There's no protocol-
  level "that id doesn't exist" acknowledgment; the only sign anything
  went wrong is a log line on a machine the client can't see.
- **`ws`'s `autoPong` option defaults to `true` and ignores whatever
  `'ping'` listener you attach yourself.** The first version of the
  zombie test client just removed the default `'ping'` handling and
  logged instead — which looked correct for the first two ping cycles,
  because the server kept getting pongs anyway (sent automatically at
  the protocol level, independent of application-level event listeners)
  and the heartbeat timeout never fired. The fix: `new WebSocket(url, {
  autoPong: false })`. The broken version and the working version are
  indistinguishable by watching the first few seconds — only waiting out
  the full real timeout exposed it.
- **A connection that times out produces two presence broadcasts, not
  one.** The heartbeat's `terminate()` branch broadcasts `"timed-out"`,
  and the socket's `close` handler — which fires regardless of *why* the
  connection closed — broadcasts `"left"` for the same disconnection
  right after. Every surviving client's log shows `joined`, `timed-out`,
  `left` for one connection lifecycle. Not incorrect, but redundant.
- **Port 8080 was already occupied by something unrelated** on the
  machine this ran on, before any of today's testing started. Nothing to
  do with WebSockets — just the ordinary cost of a very commonly used
  default dev port. Running server and every client against `PORT=8081`
  sidestepped it completely.

### Part 4 — mapping back to Days 7-9

| What Days 7-9 gave for free | What WebSockets give instead |
| --- | --- |
| Durability — a message survives a disconnected consumer | None — a message sent while a client is gone is just gone; no DLQ, no redelivery, nothing to replay |
| At-least-once delivery, enforced by the platform | None built in — if the server still thinks a socket is `OPEN`, the send is "best effort, no confirmation," full stop |
| Decoupled producer/consumer lifetimes | Coupled by design — a message only reaches a client that is connected *right now* |
| A durable log a late consumer can rejoin (`fromBeginning`, `seek`) | No log at all — there's no history to join after the fact |
| — | **The server can speak first**, unprompted, to one specific open connection — no polling, no broker in between, nothing for the "consumer" to request |

The honest summary: Days 7-9 all traded immediacy for durability — every
mechanism explored (committed offsets, visibility timeouts, ack
deadlines) exists specifically to survive a consumer not being there
right now. WebSockets trade the opposite way: as immediate as a direct
connection gets, but a client that isn't there right now gets nothing,
ever, unless the application itself builds buffering on top of it.

## Code walkthrough

- `src/server.ts` — clients tracked in a `Map` keyed by server-generated
  id; `broadcast()` (Part 1) and `send()` (Part 2) are separate functions
  with separate call sites so the two codepaths stay easy to tell apart;
  the heartbeat `setInterval` at the bottom is where Part 3 lives
  entirely — ping everyone each tick, terminate anyone whose last pong is
  older than the timeout.
- `src/client.ts` — stdin commands `create <title>` and `dm <clientId>
  <text>` map directly to Parts 1 and 2; `--zombie` constructs the socket
  with `{ autoPong: false }` specifically to produce a connection
  indistinguishable from a live one at the TCP level, which is what Part
  3 is actually testing for.
- `public/index.html` — zero-build browser alternative for Part 1; no
  bundler, just a raw `WebSocket` and a form.

## Gotchas / things that tripped me up

- Addressing a `dm` by a client's own display name instead of its
  server-assigned id — a genuine mistake while testing, but a useful one:
  it proved the "unknown id, silent drop" path without having to engineer
  it deliberately.
- `ws`'s `autoPong` defaulting to `true` and silently overriding a
  removed `'ping'` listener — the single biggest trap of the day, because
  the broken zombie client *looked* correct for the first two ping
  cycles and only failed to produce a timeout on the full, real run.
- One disconnection, two presence broadcasts (`timed-out` then `left`) —
  redundant, not incorrect, but worth cleaning up before calling this
  shaped like anything production-bound.
- Port 8080 already in use by something unrelated before testing even
  began — nothing to do with WebSockets, just the ordinary reality of a
  popular default port.

## What I'd do differently

<TODO: your own words — e.g. fix the double presence-event broadcast on
timeout so a watching client sees one event, not two, by tracking *why*
a connection closed instead of treating every close the same way; try
the reconnect-with-backoff bonus and actually observe what's lost on
reconnect; replace the raw stdin command parser in client.ts with
something sturdier if this ever needs to handle messier input.>

## Further reading

- https://datatracker.ietf.org/doc/html/rfc6455
- https://github.com/websockets/ws
- https://github.com/websockets/ws/blob/master/doc/ws.md — `autoPong`
  option, under the `WebSocket` constructor options
- https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API
