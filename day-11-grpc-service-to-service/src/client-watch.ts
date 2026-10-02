/**
 * Part 3 — server-streaming client. Run as:
 *   npm run watch -- W1
 *   npm run watch -- W2      (in a second terminal, while W1 is still running)
 *   npm run create -- "buy milk"   (in a third terminal)
 *
 * WHY this file does NOT look like a request/response call, even though it
 * only sends one message: calling `watchTodos()` returns a readable stream
 * immediately, before the server has sent anything back. All the actual
 * work happens in the `data` listener, which can fire any number of times,
 * whenever the server decides to — which in our server is "whenever some
 * OTHER process calls CreateTodo." That's the whole mechanism Part 3 is
 * testing: this call opened the door, but something unrelated walks through
 * it later.
 *
 * WHY this is still NOT "the server pushing into a connection the client
 * didn't ask for" (the thing WebSockets can do and this can't): this
 * stream only exists because THIS process called watchTodos() and is still
 * holding the call open to receive it. Kill this process, and the server's
 * `cancelled` handler fires and forgets about it — there is no way for the
 * server to re-open a stream to a client that isn't currently making this
 * call.
 */
import * as grpc from "@grpc/grpc-js";
import { Todo, TodoServiceClient } from "./gen/todo";

const label = process.argv[2] ?? "watcher";

const client = new TodoServiceClient(
  "localhost:50051",
  grpc.ChannelCredentials.createInsecure(),
);

const call = client.watchTodos({});
console.log(`[${label}] watching for new todos...`);

call.on("data", (todo: Todo) => {
  console.log(`[${label}] received #${todo.id} "${todo.title}"`);
});

call.on("end", () => {
  console.log(`[${label}] server ended the stream`);
});

call.on("error", (err: grpc.ServiceError) => {
  // A Ctrl+C on THIS process triggers this with CANCELLED — expected, not a
  // bug. A real server crash would show UNAVAILABLE instead.
  console.log(`[${label}] stream error: ${err.code} ${err.details}`);
});
