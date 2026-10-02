/**
 * Part 2 — unary client. Run as:
 *   npm run create -- "buy milk"
 *
 * WHY this file is this short: a unary gRPC call is a plain async function
 * from the caller's point of view — call it, get a value back (or an error),
 * move on. There's no stream object to manage, no "when is this done"
 * question to answer yourself; the single callback IS the answer. This is
 * the shape that should feel completely unremarkable after Day 3's tRPC —
 * that's the point of doing it first today, before the two shapes that
 * don't have a tRPC/REST equivalent.
 */
import * as grpc from "@grpc/grpc-js";
import { Todo, TodoServiceClient } from "./gen/todo";

const title = process.argv[2] ?? `untitled todo @ ${new Date().toISOString()}`;

const client = new TodoServiceClient(
  "localhost:50051",
  grpc.ChannelCredentials.createInsecure(),
);

client.createTodo({ title }, (err, response?: Todo) => {
  if (err) {
    console.error("[client-create] error:", err.message);
    process.exit(1);
  }
  console.log(`[client-create] created #${response!.id} "${response!.title}"`);
  client.close();
});
