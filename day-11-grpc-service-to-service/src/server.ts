/**
 * Day 11 — gRPC server implementing all three RPC shapes from todo.proto.
 *
 * WHY one server process handles all three: the point of today isn't to
 * compare three different services, it's to compare three different ways
 * of shaping ONE conversation between a client and a server. Keeping them
 * on one server makes it obvious that the "shape" (unary / server-stream /
 * bidi-stream) is a property of the individual RPC method, declared in the
 * .proto file — not a property of the server or the connection. A single
 * HTTP/2 connection from a client can have a unary call and a streaming
 * call in flight on it at the same time.
 */
import * as grpc from "@grpc/grpc-js";
import {
  CreateTodoRequest,
  Todo,
  TodoEvent,
  TodoServiceServer,
  TodoServiceService,
  WatchRequest,
} from "./gen/todo";

// ---------------------------------------------------------------------------
// In-memory "database". A real service would use Postgres/DynamoDB/etc —
// irrelevant to today's point, which is the transport, not the storage.
// ---------------------------------------------------------------------------
const todos: Todo[] = [];
let nextId = 1;

// WHY this exists: WatchTodos (server streaming) needs a way for CreateTodo
// (a *completely separate* call, usually from a *completely separate*
// client process) to reach every currently-open watch stream and push a
// message into it. This array of open streams is that bridge. Compare this
// to Day 10's `clients` Map of open WebSocket connections — same idea,
// different API: there you called `socket.send()`, here you call
// `call.write()` on a gRPC call object instead of a raw socket.
const watchers: grpc.ServerWritableStream<WatchRequest, Todo>[] = [];

// -----------------------------------------------------------------------
// 1) UNARY — CreateTodo
// -----------------------------------------------------------------------
// WHY unary is the simplest shape to implement: the server gets exactly one
// request object and must produce exactly one response object (or an error)
// through the callback, then it's done. There's no "stream" state to keep
// track of across multiple events — it behaves like a plain async function.
// This is structurally identical to a tRPC mutation handler (Day 3) or an
// Express POST handler (Day 1); gRPC just adds a binary wire format and a
// contract instead of hand-parsed JSON.
function createTodo(
  call: grpc.ServerUnaryCall<CreateTodoRequest, Todo>,
  callback: grpc.sendUnaryData<Todo>,
): void {
  const todo: Todo = {
    id: String(nextId++),
    title: call.request.title,
    createdAtMs: Date.now(),
  };
  todos.push(todo);
  console.log(`[server] CreateTodo -> #${todo.id} "${todo.title}"`);

  // WHY this loop is here, inside a *unary* handler: this is the one line
  // that makes Part 3 possible. CreateTodo itself never streams anything —
  // but it reaches into the SAME in-memory `watchers` array that WatchTodos
  // populates, and pushes the new todo into every currently-open watch
  // stream. This is the concrete mechanism behind "two unrelated calls,
  // one process's unary call waking up another process's open stream."
  for (const watcher of watchers) {
    watcher.write(todo);
  }

  callback(null, todo);
}

// -----------------------------------------------------------------------
// 2) SERVER STREAMING — WatchTodos
// -----------------------------------------------------------------------
// WHY this looks almost nothing like a WebSocket `connection` handler, even
// though the *outcome* (push events to an open channel) is the same: gRPC
// never gives you a bare socket. `call` here is a `ServerWritableStream` —
// an object the gRPC library hands you specifically because the CLIENT
// called this exact RPC and is holding the call open waiting for writes.
// There is no way to get a reference to this stream from outside this
// function except by registering it somewhere yourself — which is exactly
// what pushing it into `watchers` does.
function watchTodos(call: grpc.ServerWritableStream<WatchRequest, Todo>): void {
  console.log(`[server] WatchTodos -> new watcher attached (${watchers.length + 1} total)`);
  watchers.push(call);

  // WHY we listen for "cancelled": a server-streaming call is still owned
  // by the client. If the client process exits, or calls `.cancel()`, the
  // stream never gets a normal "end" the way a function return would — the
  // server has to be told, via this event, to stop holding a reference to
  // it (otherwise `watchers` would leak a dead stream forever and every
  // future CreateTodo would throw trying to write to it).
  call.on("cancelled", () => {
    const index = watchers.indexOf(call);
    if (index !== -1) watchers.splice(index, 1);
    console.log(`[server] WatchTodos -> watcher detached (${watchers.length} remaining)`);
  });
}

// -----------------------------------------------------------------------
// 3) BIDIRECTIONAL STREAMING — SyncTodos
// -----------------------------------------------------------------------
// WHY this is the one that actually resembles Day 10's WebSocket handler:
// `call` here is a `ServerDuplexStream` — readable AND writable, just like
// a WebSocket connection is both. You attach a `data` listener (incoming
// messages from THIS client) and call `.write()` whenever you want to send
// (outgoing messages to THIS client), with no fixed turn order between the
// two directions. The difference from a raw WebSocket isn't the API shape
// here, it's what's underneath: this duplex stream is one HTTP/2 stream
// multiplexed inside a shared connection the gRPC client manages, not its
// own dedicated TCP connection.
function syncTodos(call: grpc.ServerDuplexStream<TodoEvent, TodoEvent>): void {
  console.log("[server] SyncTodos -> peer connected");

  call.on("data", (event: TodoEvent) => {
    console.log(`[server] SyncTodos <- "${event.message}" (from ${event.from})`);
    // Echo straight back with a server-side timestamp, so the client can
    // see a message it SENT come back with a RECEIVED time, independent of
    // whatever it sends next — proving the two directions aren't locked to
    // request/response pairing the way unary is.
    const reply: TodoEvent = {
      from: "server",
      message: `ack: ${event.message}`,
      sentAtMs: Date.now(),
    };
    call.write(reply);
  });

  call.on("end", () => {
    console.log("[server] SyncTodos -> peer closed its send side, closing ours too");
    call.end();
  });
}

const serviceImplementation: TodoServiceServer = {
  createTodo,
  watchTodos,
  syncTodos,
};

function main() {
  const server = new grpc.Server();
  server.addService(TodoServiceService, serviceImplementation);

  const port = process.env.PORT ?? "50051";
  server.bindAsync(
    `0.0.0.0:${port}`,
    // Plaintext credentials — no TLS. Skipping cert setup on purpose, same
    // call as every local-only day; it's a separate, infra-flavored problem.
    grpc.ServerCredentials.createInsecure(),
    (err, boundPort) => {
      if (err) {
        console.error("[server] failed to bind:", err);
        process.exit(1);
      }
      console.log(`[server] TodoService listening on :${boundPort}`);
    },
  );
}

main();
