/**
 * Part 4 — bidirectional-streaming client. Run as:
 *   npm run sync -- A
 *   npm run sync -- B      (in a second terminal)
 *
 * WHY this is the client that finally looks like Day 10's WebSocket code:
 * `call` is readable AND writable at once, exactly like a `WebSocket`
 * instance is. We attach a `data` listener for whatever arrives, and call
 * `.write()` on our own schedule, with neither side waiting for the other's
 * turn. That symmetry is real — it's not a trick of the API.
 *
 * WHY it's still not the same thing underneath: this duplex stream is ONE
 * HTTP/2 stream, multiplexed inside a connection the @grpc/grpc-js client
 * manages and can share with other calls (see the bonus round). A
 * WebSocket is its own dedicated TCP connection from the moment of the
 * handshake. You can't see that difference from this file's code — only
 * from killing the process and comparing the error gRPC gives you here
 * against WebSockets' `code=1006` from Day 10 (see solution.md).
 */
import * as grpc from "@grpc/grpc-js";
import { TodoEvent, TodoServiceClient } from "./gen/todo";

const label = process.argv[2] ?? "peer";

const client = new TodoServiceClient(
  "localhost:50051",
  grpc.ChannelCredentials.createInsecure(),
);

const call = client.syncTodos();
console.log(`[${label}] syncing...`);

call.on("data", (event: TodoEvent) => {
  const t = new Date(Number(event.sentAtMs)).toISOString().slice(11, 23);
  console.log(`[${label}] <- ${t} "${event.message}" (from ${event.from})`);
});

call.on("end", () => {
  console.log(`[${label}] peer ended its stream`);
});

call.on("error", (err: grpc.ServiceError) => {
  console.log(`[${label}] stream error: ${err.code} ${err.details}`);
});

// Send a message every 1.5s so two running instances produce visibly
// interleaved sent/received timestamps instead of a strict back-and-forth.
let counter = 0;
const interval = setInterval(() => {
  counter += 1;
  const message = `${label}-msg-${counter}`;
  const event: TodoEvent = { from: label, message, sentAtMs: Date.now() };
  const t = new Date(event.sentAtMs).toISOString().slice(11, 23);
  console.log(`[${label}] -> ${t} "${message}"`);
  call.write(event);
}, 1500);

process.on("SIGINT", () => {
  clearInterval(interval);
  call.end();
  process.exit(0);
});
