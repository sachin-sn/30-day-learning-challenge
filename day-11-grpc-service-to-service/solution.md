# Day 11 — Solution: gRPC Service-to-Service Communication

**Blog post:** <link, once published>
**LinkedIn post:** <link, once shared>

## Setup

```
npm install
npm run proto:gen   # compiles proto/todo.proto -> src/gen/todo.ts
npm run server      # terminal 1
npm run create -- "buy milk"   # terminal 2 (unary)
npm run watch -- W1             # terminal 2 — server streaming
npm run watch -- W2             # terminal 3 — open a second watcher first,
                                 # then run `create` again in another terminal
npm run sync -- A                # terminal 2 — bidirectional streaming
npm run sync -- B                # terminal 3
```

`proto:gen` needs a `protoc` binary on `PATH`. The `grpc-tools` npm
package normally provides one, but its install step downloads a prebuilt
binary that may be blocked on some networks (see Gotchas) — if so,
install it directly: `brew install protobuf` (Mac) or `apt install
protobuf-compiler` (Linux).

## Approach

One `.proto` file (`proto/todo.proto`), one service, three RPCs — one of
each shape gRPC supports: `CreateTodo` (unary), `WatchTodos` (server
streaming), `SyncTodos` (bidirectional streaming). One server process
implements all three, so the comparison is fair: same process, same
in-memory todo list, only the RPC shape changes. Used `ts-proto` for
codegen instead of `@grpc/proto-loader`'s runtime loading specifically
because Part 2 needs the generated types to be real TypeScript
interfaces the compiler checks — a dynamically-loaded proto doesn't give
you that. System `protoc` (via `apt install protobuf-compiler`) instead
of the `grpc-tools` npm package — more on why under Gotchas.

## Key concepts learned

- **The three RPC shapes are declared once, in the contract, not chosen
  by how the client happens to call them.** `watchTodos(request)` returns
  a readable stream the instant it's called — there's no way to call it
  "normally" and get a single value back, because the `.proto` says
  `returns (stream Todo)`. The shape is a property of the method
  signature, not a runtime decision either side makes.
- **Unary really is just an async function with extra ceremony.**
  `CreateTodo`'s handler takes one request, produces one response through
  a callback, and is done — structurally identical to Day 3's tRPC
  mutation handlers and Day 1's Express POST handler. Nothing about gRPC
  changes that shape; it only changes the wire format (binary protobuf
  instead of hand-parsed JSON) and adds the generated contract.
- **A server-streaming call only exists because the client is still
  holding it open — there's no way around that.** `WatchTodos` pushed a
  newly created todo into two independently-running watcher processes
  (`W1` and `W2`) the moment a *third*, unrelated process called
  `CreateTodo`:

  ```
  [server] WatchTodos -> new watcher attached (1 total)
  [server] WatchTodos -> new watcher attached (2 total)
  [server] CreateTodo -> #2 "walk the dog"
  [W1] received #2 "walk the dog"
  [W2] received #2 "walk the dog"
  ```

  But this is still **not** the server pushing into a connection the
  client never asked for (the thing a WebSocket can do and this can't):
  both `W1` and `W2` only received `#2`, never `#1` (created before they
  attached) — confirming there's no backlog, no "join and catch up."
  `WatchTodos` only delivers what happens *while the call is open*,
  because the stream's entire existence is tied to the client's call
  still being in flight. Kill the watcher process, and the server finds
  out immediately via the `cancelled` event and forgets it:

  ```
  [server] WatchTodos -> watcher detached (1 remaining)
  ```

- **Bidirectional streaming is the one shape that actually looks like
  Day 10's WebSocket code — same read/write symmetry, different
  transport underneath.** Two `SyncTodos` clients (`A` and `B`) each sent
  messages on their own 1.5s timer, completely independent of each
  other and of the server's replies:

  ```
  [A] -> 13:31:02.995 "A-msg-1"
  [A] <- 13:31:03.001 "ack: A-msg-1" (from server)
  [B] -> 13:31:07.030 "B-msg-1"
  [B] <- 13:31:07.034 "ack: B-msg-1" (from server)
  ```

  Interleaved sends and receives with no fixed turn order — exactly what
  Day 10's full-duplex socket did. The difference is invisible from this
  log: it only shows up in how each one fails (next point).
- **Killing a process mid-stream produces different signals depending on
  which side died — and localhost makes the "slow death" case hard to
  simulate here too, same lesson as Day 10.** Killing a `SyncTodos`
  *client* with `kill -9` made the **server** log a clean `end` within
  about a second:

  ```
  [server] SyncTodos -> peer closed its send side, closing ours too
  ```

  That's the same honest limitation Day 10 ran into: a same-machine
  `kill -9` tears the TCP connection down almost immediately at the OS
  level, so gRPC's HTTP/2 stream sees a normal half-close, not a hang.
  Killing the **server** instead, while a client was still running,
  produced a real, distinguishable error on the client side — a gRPC
  status code, not a raw socket code like WebSockets' `1006`:

  ```
  [B] stream error: 14 Connection dropped
  [B] peer ended its stream
  ```

  Status `14` is `UNAVAILABLE` — gRPC's own vocabulary for "the other end
  is gone," parallel to Day 10's `code=1006` but delivered as a
  structured status instead of a bare numeric close code.
- **A field removed from the shared contract breaks the build, not the
  run.** Deleted `title` from the `Todo` message in `todo.proto`,
  regenerated the TypeScript stubs, and tried to compile — no code was
  touched, only the contract:

  ```
  src/client-create.ts(28,70): error TS2339: Property 'title' does not exist on type 'Todo'.
  src/client-watch.ts(38,56): error TS2339: Property 'title' does not exist on type 'Todo'.
  src/server.ts(55,5): error TS2353: Object literal may only specify known properties, and 'title' does not exist in type 'Todo'.
  src/server.ts(59,59): error TS2339: Property 'title' does not exist on type 'Todo'.
  ```

  Day 1's equivalent mistake (dropping a field from a hand-written JSON
  response) would have shipped silently and shown up as `undefined` at
  runtime, found only by whoever happened to log the right value. Here
  it's four compiler errors before anything runs. Restored the field and
  regenerated to get back to a clean build before moving on.

### Mapping back: gRPC vs. Day 10's WebSockets vs. Day 3's tRPC

| Today's RPC        | Closest to          | Why                                                                                   | Where the comparison breaks down                                                                 |
| ------------------- | ------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `CreateTodo` (unary) | tRPC mutation (Day 3) | One request, one response, done — no stream state either side has to manage           | None really — this is the shape gRPC shares with almost everything else                           |
| `WatchTodos` (server streaming) | Closest to a WebSocket broadcast, but narrower | Multiple events flow to the client over time, from an unrelated trigger elsewhere | No backlog, and the stream can't outlive the call — a WebSocket connection has no such "I must still be asking" requirement |
| `SyncTodos` (bidi streaming) | Day 10's full-duplex socket | Both sides read and write independently, no turn order | One HTTP/2 stream multiplexed inside a shared connection, not its own dedicated TCP connection — invisible until something fails (see the kill tests above) |

The honest summary: gRPC's three shapes map cleanly onto "no stream,"
"server talks more than the client," and "both talk whenever" — but even
the shape that looks identical to a WebSocket in code (`SyncTodos`) is
still fundamentally a *call* your client made and is still holding open,
layered over HTTP/2, not a raw socket. That distinction stayed invisible
through every normal exchange and only surfaced once something was
deliberately killed.

## Code walkthrough

- `proto/todo.proto` — the contract: one service, three RPCs, one of each
  shape. Comments inline explain why each message/RPC is shaped the way
  it is.
- `src/server.ts` — all three handlers on one server. `watchers`, the
  array of open server-streaming calls, is the concrete mechanism behind
  "an unrelated unary call wakes up an open stream" — `createTodo` writes
  into it directly.
- `src/client-create.ts` — Part 2, the unary client.
- `src/client-watch.ts` — Part 3, the server-streaming client. Run two
  copies with different labels to reproduce the fan-out test.
- `src/client-sync.ts` — Part 4, the bidirectional-streaming client. Run
  two copies to see independent, interleaved sends.
- `src/gen/todo.ts` — generated by `ts-proto`; not hand-written. Run
  `npm run proto:gen` to regenerate it after any `.proto` change (it's
  not committed — see `.gitignore`).

## Gotchas / things that tripped me up

- The `grpc-tools` npm package (the usual way to get a `protoc` binary
  for Node projects) tries to download a prebuilt binary from
  `node-precompiled-binaries.grpc.io` during `npm install`, and that
  download came back `403 Forbidden` in this environment. Worked around
  it with the system package manager instead (`apt install
  protobuf-compiler`, or `brew install protobuf` on a Mac) and pointed
  `ts-proto`'s codegen at that `protoc` directly — same generated output,
  no S3-flavored install step at all.
- Every `snake_case` field in the `.proto` (`created_at_ms`, `sent_at_ms`)
  comes out `camelCase` in the generated TypeScript (`createdAtMs`,
  `sentAtMs`). Not a bug, just a convention to know about before
  wondering why the field "isn't there."
- After the server process was killed, client `B`'s `setInterval` kept
  calling `call.write()` on a stream that had already errored —
  `@grpc/grpc-js` didn't throw, it just silently dropped the writes
  (`B-msg-20`, `21`, `22` were sent into the void, never acked). A
  real client would need to stop its own send loop on the `error`/`end`
  event instead of assuming the stream is still live.
- `kill -9` on a same-machine process is, again, not a reliable way to
  simulate a genuinely stuck-but-undetected connection — same limitation
  Day 10 ran into with raw WebSockets. Both the client-killed and
  server-killed tests above produced a clean, fast signal on the
  surviving side, not a hang. Testing the case gRPC's keepalive pings are
  actually meant to catch would need a real network partition (or at
  least two separate machines / containers), not just local process kills.

## What I'd do differently

<TODO: your own words — e.g. add client-side keepalive options
(`grpc.keepalive_time_ms`, etc.) and actually test them against a
simulated network partition instead of a same-machine kill, since
today's kill tests couldn't exercise that path; make `client-sync.ts`
stop its send loop on `error`/`end` instead of silently writing into a
dead stream; try the grpc-web bonus round and see the proxy requirement
firsthand instead of just reading about it.>

## Further reading

- https://grpc.io/docs/languages/node/
- https://protobuf.dev/programming-guides/proto3/
- https://github.com/stephenh/ts-proto
- https://github.com/grpc/grpc-web
- https://grpc.github.io/grpc/core/md_doc_statuscodes.html — status code
  `14` (`UNAVAILABLE`) and what the others mean
