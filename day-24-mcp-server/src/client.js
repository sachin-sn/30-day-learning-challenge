import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const show = (label, value) => console.log(`\n--- ${label} ---\n` + JSON.stringify(value, null, 2));

async function timed(label, args, fn) {
  const t = performance.now();
  try {
    const result = await fn();
    const ms = performance.now() - t;
    show(`${label}: request`, args);
    show(`${label}: response (${ms.toFixed(1)} ms)`, result);
  } catch (err) {
    const ms = performance.now() - t;
    show(`${label}: request`, args);
    console.log(`\n--- ${label}: THROWN ERROR (${ms.toFixed(1)} ms) ---`);
    console.log(`${err.name}: ${err.message}`);
    if (err.code !== undefined) console.log("code:", err.code);
  }
}

const transport = new StdioClientTransport({ command: "node", args: ["server.js"] });
const client = new Client({ name: "day24-client", version: "1.0.0" });

const tConnect = performance.now();
await client.connect(transport);
console.log(`connected in ${(performance.now() - tConnect).toFixed(1)} ms`);

await timed("tools/list", {}, () => client.listTools());

const calls = [
  ["call 1: hash", { name: "hash", arguments: { input: "abc" } }],
  ["call 2: info", { name: "info", arguments: {} }],
  ["call 3: hash (again)", { name: "hash", arguments: { input: "abc" } }],
  ["BAD: hash with a number", { name: "hash", arguments: { input: 123 } }],
  ["BAD: hash with no argument", { name: "hash", arguments: {} }],
  ["BAD: tool that does not exist", { name: "nope", arguments: {} }],
];
for (const [label, params] of calls) {
  await timed(label, params, () => client.callTool(params));
}

await client.close();
