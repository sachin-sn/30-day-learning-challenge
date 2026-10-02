# Day 11 — Solution: gRPC Service-to-Service Communication

**Blog post:** <link, once published>
**LinkedIn post:** <link, once shared>

## Setup

```
npm install
mkdir -p src/gen        # protoc/ts-proto won't create this directory itself
npm run proto:gen       # compiles proto/todo.proto -> src/gen/todo.ts
npm run server          # terminal 1
npm run create "buy milk"   # terminal 2 (unary)
npm run watch W1             # terminal 2 — server streaming
npm run watch W2             # terminal 3 — open a second watcher first,
                              # then run `create` again in another terminal
npm run sync A                # terminal 2 — bidirectional streaming
npm run sync B                # terminal 3
```

`proto:gen` needs a `protoc` binary on `PATH`, and it won't create
`src/gen/` on its own — if that folder doesn't exist yet, codegen fails
with `./src/gen/: No such file or directory`. See Gotchas for how I
actually got `protoc` installed, since the "obvious" ways both failed on
an Intel Mac.

## Approach

One `.proto` file (`proto/todo.proto`), one service, three RPCs — one of
each shape gRPC supports: `CreateTodo` (unary), `WatchTodos` (server
streaming), `SyncTodos` (bidirectional streaming). One server process
implements all three, so the comparison is fair: same process, same
in-memory todo list, only the RPC shape changes. Used `ts-proto` for
codegen instead of `@grpc/proto-loader`'s runtime loading specifically
because Part 2 needs the generated types to be real TypeScript
interfaces the compiler checks — a dynamically-loaded proto doesn't give
you that.

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
  mutation handlers and Day 1's Express POST handler. Created four real
  todos this way (`#1 "buy"`, `#2 "buy Ducati scrambler"`, `#3 "buy Ducati
  multistrada v2"`, `#4 "buy Ducati multistrada v2s"` — hard to write a
  todo app example without it turning into a bike shopping list). Nothing
  about gRPC changes the shape; it only changes the wire format (binary
  protobuf instead of hand-parsed JSON) and adds the generated contract.
- **A server-streaming call only exists because the client is still
  holding it open — there's no way around that, and the "does a late
  watcher get a backlog" question has a real, confirmed answer: no.**
  Watcher `W1` attached *after* `#1` and `#2` already existed, and only
  ever received `#3` and `#4`:

  ```
  [watcher] watching for new todos...
  [watcher] received #3 "buy Ducati multistrada v2"
  [watcher] received #4 "buy Ducati multistrada v2s"
  ```

  Watcher `W2` attached even later — after `#3` already existed too —
  and received *only* `#4`:

  ```
  [watcher] watching for new todos...
  [watcher] received #4 "buy Ducati multistrada v2s"
  ```

  That's the direct, observed answer to the prediction question: no
  backlog, no "join and catch up." `WatchTodos` only delivers what
  happens *while the call is open*, because the stream's entire existence
  is tied to the client's call still being in flight — there's no stored
  history anywhere on the server for a new watcher to replay.
- **Bidirectional streaming is the shape that actually looks like Day
  10's WebSocket code — same read/write symmetry — but two peers talking
  through the same server stayed provably independent of each other, not
  just in theory.** Ran two `SyncTodos` clients, `A` and `B`, concurrently
  in separate terminals. `A` started first (`15:20:53`) and `B` joined 17
  seconds later (`15:21:10`), each on its own untouched 1.5s send timer:

  ```
  [A] -> 15:20:53.944 "A-msg-1"
  [A] <- 15:20:53.952 "ack: A-msg-1" (from server)
  ...
  [B] -> 15:21:10.096 "B-msg-1"
  [B] <- 15:21:10.099 "ack: B-msg-1" (from server)
  ```

  Both kept running for minutes with sub-10ms round trips on every single
  ack, completely oblivious to each other.
- **Killing one peer mid-exchange produced a more interesting result than
  "the other side gets an error" — it produced no visible effect on the
  other side at all, which turned out to be the real lesson.** Killed `A`
  with `kill -9` while both were mid-exchange — `A`'s last message was
  `A-msg-143`, `B` was on `B-msg-133` at that exact moment:

  ```
  [server] SyncTodos <- "A-msg-143" (from A)
  [server] SyncTodos <- "B-msg-133" (from B)
  [server] SyncTodos -> peer closed its send side, closing ours too
  ```

  `B` never noticed. It kept sending and getting acked on schedule —
  `B-msg-134`, `135`, `136`... — straight through `A`'s death and for
  minutes afterward, with zero error, zero pause, nothing. The honest
  revision to my own prediction going in: I expected "the other side gets
  an error," but there *is* no other side in the direct sense — each
  `SyncTodos` call is a private stream between one client and the server,
  never client-to-client. The only place the failure is visible at all is
  in the server's log for that one specific connection. Same localhost
  limitation Day 10 ran into, too: a same-machine `kill -9` tears the TCP
  connection down fast enough that the server sees an ordinary clean
  half-close, not a hang — there's no "zombie connection" moment to catch
  here the way the heartbeat mechanism was built to catch on Day 10.
- **A field removed from the shared contract breaks the build, not the
  run.** Deleted `title` from the `Todo` message in `todo.proto`,
  regenerated the TypeScript stubs, and tried to compile — no application
  code touched, only the contract. The compiler rejected every file that
  still referenced `.title` on a `Todo` (`server.ts`, `client-create.ts`,
  `client-watch.ts`) with `TS2339: Property 'title' does not exist on
  type 'Todo'` and the matching `TS2353` on the object-literal side. Day
  1's equivalent mistake (dropping a field from a hand-written JSON
  response) would have shipped silently and shown up as `undefined` at
  runtime, found only by whoever happened to log the right value. Here
  it's compiler errors before anything runs at all. Restored the field,
  regenerated, confirmed a clean build again before moving on.

### Mapping back: gRPC vs. Day 10's WebSockets vs. Day 3's tRPC

| Today's RPC        | Closest to          | Why                                                                                   | Where the comparison breaks down                                                                 |
| ------------------- | ------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `CreateTodo` (unary) | tRPC mutation (Day 3) | One request, one response, done — no stream state either side has to manage           | None really — this is the shape gRPC shares with almost everything else                           |
| `WatchTodos` (server streaming) | Closest to a WebSocket broadcast, but narrower | Multiple events flow to the client over time, from an unrelated trigger elsewhere | No backlog, and the stream can't outlive the call — a WebSocket connection has no such "I must still be asking" requirement |
| `SyncTodos` (bidi streaming) | Day 10's full-duplex socket | Both sides read and write independently, no turn order | It's a call between ONE client and the server, not a channel between peers — killing one peer is invisible to any other peer, unlike a WebSocket broadcast hub that actively tracks and could notify every connection |

The honest summary: gRPC's three shapes map cleanly onto "no stream,"
"server talks more than the client," and "both talk whenever" — but even
the shape that looks identical to a WebSocket in code (`SyncTodos`) is
still fundamentally a *call* your own client made and is still holding
open, between you and the server only. That distinction stayed invisible
through every normal exchange and only surfaced once something was
deliberately killed and nothing happened to the other peer.

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
  copies with different labels to reproduce the fan-out/no-backlog test.
- `src/client-sync.ts` — Part 4, the bidirectional-streaming client. Run
  two copies to see independent, interleaved sends.
- `src/gen/todo.ts` — generated by `ts-proto`; not hand-written. Run
  `npm run proto:gen` to regenerate it after any `.proto` change (it's
  not committed — see `.gitignore`).

## Gotchas / things that tripped me up

- Getting `protoc` onto an Intel Mac turned into its own side quest.
  `brew install protobuf` refused outright — Homebrew has dropped support
  for Intel macOS (Tier 3 as of this run), so there's no prebuilt bottle,
  and it fell back to compiling from source, which immediately hit a
  broken Xcode Command Line Tools install (`xcrun: error: unable to load
  libxcrun.dylib` — an arch mismatch in the CLT itself). Fixing CLT just
  to get one binary wasn't worth it — downloaded the official precompiled
  `protoc-*-osx-x86_64.zip` straight from the protobuf GitHub releases
  page instead and dropped it on `PATH`. No compiler needed at all.
- Every file I downloaded individually landed flat in the project root
  instead of inside `proto/`/`src/` — `todo.proto` specifically ended up
  sitting inside `src/` next to the `.ts` files instead of in its own
  `proto/` folder, which produced a very unhelpful `Could not make proto
  path relative: proto/todo.proto: No such file or directory` until I
  noticed and moved it.
- `protoc`/`ts-proto` won't create their own output directory — the very
  first `npm run proto:gen` failed with `./src/gen/: No such file or
  directory` until I `mkdir -p src/gen` first. Worth doing before the
  first run, not after the error.
- Every `snake_case` field in the `.proto` (`created_at_ms`, `sent_at_ms`)
  comes out `camelCase` in the generated TypeScript (`createdAtMs`,
  `sentAtMs`). Not a bug, just a convention to know about before
  wondering why the field "isn't there."
- `kill -9` on a same-machine process is, once again, not a reliable way
  to simulate a genuinely stuck-but-undetected connection — same
  limitation Day 10 ran into with raw WebSockets. Killing `A` mid-sync
  produced a clean, fast half-close on the server side, not a hang, and
  (more interesting) produced *zero* visible effect on `B` at all, since
  the two peers were never actually connected to each other.

## What I'd do differently

<TODO: your own words — e.g. add client-side keepalive options
(`grpc.keepalive_time_ms`, etc.) and actually test them against a
simulated network partition instead of a same-machine kill, since
today's kill test couldn't exercise that path; try killing the SERVER
process instead of a client and see what error a still-running `SyncTodos`
client actually gets, as the more direct comparison to Day 10's
`code=1006`; try the grpc-web bonus round and see the proxy requirement
firsthand instead of just reading about it.>

## Further reading

- https://grpc.io/docs/languages/node/
- https://protobuf.dev/programming-guides/proto3/
- https://github.com/stephenh/ts-proto
- https://github.com/grpc/grpc-web
- https://grpc.github.io/grpc/core/md_doc_statuscodes.html — gRPC status
  codes, including `14` (`UNAVAILABLE`), gRPC's equivalent of "the other
  end is gone"
