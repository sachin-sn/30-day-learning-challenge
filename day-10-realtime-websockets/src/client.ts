import WebSocket from "ws";

const PORT = Number(process.env.PORT ?? 8080);
const name = process.argv[2] ?? "anon";
const zombieMode = process.argv.includes("--zombie");

// `ws` responds to every incoming ping with a pong automatically at the
// protocol level (the `autoPong` option, default true) — independent of
// whatever 'ping' listeners you attach yourself. Removing/overriding the
// 'ping' event does NOT stop this; you have to disable `autoPong`
// explicitly in the constructor, which is what zombie mode does below.
const ws = new WebSocket(`ws://localhost:${PORT}`, zombieMode ? { autoPong: false } : undefined);
let myId: string | undefined;

ws.on("open", () => {
  console.log(`[${name}] connected`);
});

if (zombieMode) {
  // With autoPong disabled, the server's pings arrive but are never
  // answered — simulating a connection that's technically still open at
  // the TCP level but will never satisfy the server's heartbeat. This is
  // the honest way to demonstrate Part 3's "looks alive, isn't" case; a
  // plain `kill -9` on localhost usually does NOT reproduce it reliably,
  // because the OS tears the socket down (and the server sees a close
  // almost immediately) when a process on the same machine dies.
  ws.on("ping", () => {
    console.log(`[${name}] (zombie mode) got a ping — autoPong disabled, not responding`);
  });
  console.log(`[${name}] running in --zombie mode: pings will be received but never answered`);
}

ws.on("message", (raw) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === "welcome") {
    myId = msg.id;
    console.log(`[${name}] assigned id ${myId} — use this id as the <clientId> for "dm"`);
  } else {
    console.log(`[${name}] <-`, msg);
  }
});

ws.on("close", (code, reason) => {
  console.log(`[${name}] disconnected (code=${code} reason=${reason.toString() || "none"})`);
});

ws.on("error", (err) => {
  console.log(`[${name}] error: ${err.message}`);
});

// Minimal stdin command interface, one command per line:
//   create <title>          -> broadcast a new todo to every client (Part 1)
//   dm <clientId> <text>    -> send a direct message to one specific client (Part 2)
console.log(`[${name}] commands: create <title>   |   dm <clientId> <text>`);
process.stdin.setEncoding("utf8");
process.stdin.on("data", (data) => {
  const line = data.toString().trim();
  if (!line) return;
  const [cmd, ...rest] = line.split(" ");

  if (cmd === "create") {
    const title = rest.join(" ");
    if (!title) {
      console.log(`[${name}] usage: create <title>`);
      return;
    }
    ws.send(JSON.stringify({ type: "create-todo", title }));
  } else if (cmd === "dm") {
    const [to, ...textParts] = rest;
    if (!to || textParts.length === 0) {
      console.log(`[${name}] usage: dm <clientId> <text>`);
      return;
    }
    ws.send(JSON.stringify({ type: "direct-message", to, text: textParts.join(" ") }));
  } else {
    console.log(`[${name}] unknown command "${cmd}". Use: create <title>   |   dm <clientId> <text>`);
  }
});
