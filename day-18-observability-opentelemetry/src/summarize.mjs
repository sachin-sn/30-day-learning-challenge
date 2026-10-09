// Usage: node summarize.mjs spans.log
// Reads the ConsoleSpanExporter output and prints one line per span
// (trace id, span name, parent span id, duration in ms), then one line per trace
// with the share of slowLookup in the root (HTTP) span.
import { readFileSync } from "node:fs";

const text = readFileSync(process.argv[2], "utf8");
const blocks = text.split(/\n(?=\{\n  resource:)/);
const spans = [];
for (const b of blocks) {
  const traceId = b.match(/\n  traceId: '([0-9a-f]+)'/)?.[1];
  const name = b.match(/\n  name: '([^']*)'/)?.[1];
  const id = b.match(/\n  id: '([0-9a-f]+)'/)?.[1];
  const duration = b.match(/\n  duration: ([0-9.]+)/)?.[1];
  const parent = b.match(/parentSpanContext: \{[^}]*spanId: '([0-9a-f]+)'/)?.[1];
  if (!traceId || !name || !id || !duration) continue;
  spans.push({ traceId, name, id, parent: parent ?? "-", ms: Number(duration) / 1000 });
}

console.log("trace      span id          parent           ms      name");
for (const s of spans) {
  console.log(
    `${s.traceId.slice(0, 8)}  ${s.id}  ${s.parent.padEnd(16)} ${s.ms.toFixed(1).padStart(7)}  ${s.name}`
  );
}

console.log("\nper trace: root span (no parent), slowLookup, share");
const byTrace = new Map();
for (const s of spans) {
  if (!byTrace.has(s.traceId)) byTrace.set(s.traceId, []);
  byTrace.get(s.traceId).push(s);
}
for (const [t, list] of byTrace) {
  const root = list.find((s) => s.parent === "-");
  const slow = list.find((s) => s.name === "slowLookup");
  const share = root && slow ? ((slow.ms / root.ms) * 100).toFixed(0) + "%" : "-";
  console.log(
    `${t.slice(0, 8)}  spans=${list.length}  root=${root?.name ?? "?"} ${root?.ms.toFixed(1) ?? "?"} ms  slowLookup=${slow?.ms.toFixed(1) ?? "-"} ms  share=${share}`
  );
}
