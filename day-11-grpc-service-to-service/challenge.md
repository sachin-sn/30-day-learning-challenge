# Day 11 — gRPC Service-to-Service Communication

**Difficulty:** Intermediate
**Tech stack:** gRPC, Protocol Buffers, TypeScript, Node.js (`@grpc/grpc-js`, `ts-proto`)
**Estimated time:** 2-3 hours

## Why this matters

Day 3 covered a typed contract for browser-to-server calls (tRPC); Day 10
covered a raw, connection-oriented channel with no contract at all
(WebSockets). gRPC sits in a third spot: a typed contract, like tRPC, but
designed for service-to-service traffic inside a system, not for a
browser tab — and it adds something neither of those had, streaming in
both directions as a first-class part of the contract rather than
something bolted on. This is the default choice for internal microservice
communication at most companies running polyglot stacks (a Go service
calling a Java service calling a Node service), and "why would you reach
for gRPC instead of REST or tRPC here" is a recurring interview question
once a system has more than one service.

## Learning objectives

By the end of today you should be able to:

- Define a service contract in a `.proto` file and generate TypeScript
  types and stubs from it, instead of hand-writing either side
- Implement a unary RPC (plain request/response) and confirm that a
  required field removed on the server is caught by the generated types
  at compile time on the client — something Day 1's hand-rolled JSON
  endpoints never gave you
- Implement a server-streaming RPC and explain precisely why it is still
  fundamentally different from Day 10's `broadcast()`: a gRPC stream only
  exists because a client called the method and is still holding the
  call open, where a WebSocket server can push into a connection the
  client isn't actively requesting anything on
- Implement a bidirectional-streaming RPC and compare it honestly to Day
  10's full-duplex socket — what's actually the same (either side can
  send at any time) and what's actually different (the gRPC stream is one
  logical call multiplexed over a shared HTTP/2 connection, not its own
  dedicated TCP connection)
- Explain why gRPC is a service-to-service protocol by convention, not by
  law — a browser can't speak it directly without a translating proxy
  (grpc-web + Envoy), unlike Day 10's WebSocket, which every browser
  speaks natively

## The challenge

Build a `TodoService` as a `.proto` contract, implement it with one
server process, and drive it from separate client processes — same
todo-app domain as every prior day, so the only new variable is the
transport.

**Part 1 — contract first.** Write `todo.proto` defining three RPCs on
one service:

- `CreateTodo(CreateTodoRequest) returns (Todo)` — unary
- `WatchTodos(WatchRequest) returns (stream Todo)` — server streaming
- `SyncTodos(stream TodoEvent) returns (stream TodoEvent)` — bidirectional
  streaming

Generate TypeScript types and stubs from it (`ts-proto` is the
recommended generator; `@grpc/proto-loader` works too if you'd rather
load the `.proto` at runtime instead of codegen). Implement the server
for all three RPCs before testing any of them.

**Part 2 — unary parity check.** Implement `CreateTodo` and call it from
a client. Then deliberately remove a required field from a message in
the `.proto`, regenerate, and confirm the client fails to **compile**,
not just fails at runtime — this is the comparison point against Day 1's
plain `JSON.parse`, where the same mistake would have been a silent
`undefined` discovered only by running the code.

**Part 3 — server streaming vs. Day 10's broadcast.** Implement
`WatchTodos` so a client that calls it receives every `Todo` created
afterward, for as long as it keeps the call open. Start two separate
watcher processes, then create a todo from a third, unrelated process via
the unary `CreateTodo` call, and confirm both watchers receive it. Before
you run it, write down what you think happens if a *fourth* process
starts watching after the todo was already created — does it get the
backlog or only what's created from that point on? Then check.

**Part 4 — bidirectional streaming vs. Day 10's full duplex.** Implement
`SyncTodos` so two processes can send `TodoEvent` messages to each other
over the same call, independently of each other's send timing. Run two
processes syncing with each other, and from each log timestamps showing
a message you sent and a message you received interleaving rather than
strictly alternating. Then kill one process mid-exchange and note the
exact error the other side gets — and compare it to Day 10's clean
`code=1006` on a dead WebSocket.

**Part 5 — map it back.** In `solution.md`, write the direct
correspondence between today's three RPC shapes and Day 10's WebSocket
patterns and Day 3's tRPC calls: which gRPC RPC type is closest to a tRPC
query/mutation, which is closest to a WebSocket broadcast, and which has
no real analog in either — and say plainly where the "it's just like a
WebSocket" comparison breaks down once you've actually run Part 3 and 4.

### Requirements

- A real `.proto` file, compiled into TypeScript stubs via codegen — not
  hand-written interfaces that happen to match
- Working unary, server-streaming, and bidirectional-streaming RPCs, each
  actually run with separate client/server processes, not reasoned about
  from the code alone
- The removed-required-field compile failure from Part 2 actually
  triggered and shown, not just asserted
- Two concurrent `WatchTodos` watchers both actually confirmed receiving
  the same created todo
- The mid-exchange kill from Part 4 actually performed, with the real
  error logged
- `solution.md`'s three-way comparison table (gRPC / WebSockets / tRPC),
  written from what you observed today

### Constraints

- TypeScript throughout, same as every prior day — `@grpc/grpc-js` for
  the runtime, `ts-proto` (or `@grpc/proto-loader`) for the contract
- Everything runs locally over plaintext (skip TLS cert setup — that's a
  separate, infra-flavored problem, not today's point)
- Keep the todo domain minimal — this is about the transport, not about
  building out todo features

## Bonus round (optional)

- Open two unrelated RPC calls (e.g. a `WatchTodos` stream and a
  `CreateTodo` call) from the same client at the same time and confirm
  with a packet capture or gRPC's own logging that both are multiplexed
  over a single underlying HTTP/2 connection — this is the concrete
  evidence behind "one shared connection" rather than taking it on faith
- Try `grpc-web` in front of the server (with or without an Envoy proxy)
  and see firsthand why a plain browser `fetch`/`WebSocket` can talk to
  Day 10's server directly but needs a translation layer to reach this
  one at all
- One sentence on the actual tradeoff: gRPC gives you a strict, codegen'd
  contract and native streaming semantics; Day 10's WebSocket gives you a
  simpler mental model and zero tooling to talk to from a browser — where
  does each actually win in a system you'd own?

## Resources

- https://grpc.io/docs/languages/node/
- https://protobuf.dev/programming-guides/proto3/
- https://github.com/stephenh/ts-proto
- https://github.com/grpc/grpc-web

---

Once you've built something, write up `solution.md` in this folder using
`../_template/solution.md` as a starting point.
