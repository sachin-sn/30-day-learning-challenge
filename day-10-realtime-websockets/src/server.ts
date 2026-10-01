import { WebSocketServer, WebSocket, type RawData } from "ws";
import { randomUUID } from "crypto";

const PORT = Number(process.env.PORT ?? 8080);
const HEARTBEAT_INTERVAL_MS = 5000;
// Must exceed HEARTBEAT_INTERVAL_MS so a client gets at least one real
// chance to pong before being judged dead.
const HEARTBEAT_TIMEOUT_MS = 12000;

type Priority = "low" | "medium" | "high";
type Todo = { id: number; title: string; priority: Priority };

interface ClientRecord {
  id: string;
  socket: WebSocket;
  lastPong: number;
}

const clients = new Map<string, ClientRecord>();
let nextTodoId = 1;

const wss = new WebSocketServer({ port: PORT });

function send(client: ClientRecord, payload: unknown) {
  if (client.socket.readyState !== WebSocket.OPEN) {
    // This is the Part 2 observation point: a send aimed at a client
    // whose socket the server already knows is closed just gets logged
    // and dropped here — no throw, no queue, no retry. If the server
    // *doesn't* know yet (readyState still reports OPEN because no
    // close/error has arrived), ws.send() below can succeed silently
    // into a dead connection until the heartbeat (or the OS) catches up.
    console.log(
      `[server] skip send to ${client.id} — socket not OPEN (state=${client.socket.readyState})`
    );
    return;
  }
  client.socket.send(JSON.stringify(payload));
}

function broadcast(payload: unknown, excludeId?: string) {
  for (const client of clients.values()) {
    if (client.id === excludeId) continue;
    send(client, payload);
  }
}

wss.on("connection", (socket) => {
  const id = randomUUID().slice(0, 8);
  const record: ClientRecord = { id, socket, lastPong: Date.now() };
  clients.set(id, record);
  console.log(`[server] client ${id} connected (${clients.size} total)`);

  send(record, { type: "welcome", id });
  broadcast({ type: "presence", id, event: "joined", total: clients.size }, id);

  // ws auto-replies to a ping with a pong unless the client code
  // overrides that — the heartbeat relies on this handler firing back.
  socket.on("pong", () => {
    record.lastPong = Date.now();
  });

  socket.on("message", (raw: RawData) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      console.log(`[server] client ${id} sent non-JSON, ignoring`);
      return;
    }

    if (msg.type === "create-todo" && typeof msg.title === "string") {
      const todo: Todo = {
        id: nextTodoId++,
        title: msg.title,
        priority: (msg.priority as Priority) ?? "medium",
      };
      console.log(`[server] todo created by ${id}:`, todo);
      // Part 1: broadcast to every connected client, including the sender.
      broadcast({ type: "todo-created", todo, from: id });
      return;
    }

    if (msg.type === "direct-message" && typeof msg.to === "string") {
      const target = clients.get(msg.to);
      if (!target) {
        console.log(
          `[server] direct message from ${id} targeted unknown/disconnected client ${msg.to} — dropped`
        );
        return;
      }
      console.log(`[server] direct message ${id} -> ${msg.to}: ${msg.text}`);
      // Part 2: only the target gets this, nobody else.
      send(target, { type: "direct-message", from: id, text: msg.text });
      return;
    }

    console.log(`[server] client ${id} sent unrecognized message type:`, msg.type);
  });

  socket.on("close", (code, reason) => {
    clients.delete(id);
    console.log(
      `[server] client ${id} disconnected (code=${code} reason=${reason || "none"}, ${clients.size} remaining)`
    );
    broadcast({ type: "presence", id, event: "left", total: clients.size });
  });

  socket.on("error", (err) => {
    console.log(`[server] client ${id} socket error: ${err.message}`);
  });
});

// Part 3: the heartbeat. Every HEARTBEAT_INTERVAL_MS, ping everyone still
// in the map. Anyone who hasn't produced a pong within HEARTBEAT_TIMEOUT_MS
// gets forcibly terminated — this is what catches a connection that looks
// alive (still sitting in `clients`, readyState still OPEN) but has gone
// quiet without ever sending a proper close frame.
setInterval(() => {
  const now = Date.now();
  for (const client of [...clients.values()]) {
    if (now - client.lastPong > HEARTBEAT_TIMEOUT_MS) {
      console.log(
        `[server] client ${client.id} missed its heartbeat deadline — terminating zombie connection`
      );
      client.socket.terminate();
      clients.delete(client.id);
      broadcast({ type: "presence", id: client.id, event: "timed-out", total: clients.size });
      continue;
    }
    client.socket.ping();
  }
}, HEARTBEAT_INTERVAL_MS);

console.log(`[server] listening on ws://localhost:${PORT}`);
console.log(`[server] heartbeat: ping every ${HEARTBEAT_INTERVAL_MS}ms, timeout after ${HEARTBEAT_TIMEOUT_MS}ms`);
