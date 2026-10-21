// A very small tracer: every step of one request becomes a "span" with a start time, a duration,
// a parent and some attributes. Spans nest through AsyncLocalStorage, so a span started inside
// another span's function becomes its child without passing anything around.
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync, writeFileSync } from "node:fs";

const als = new AsyncLocalStorage();
export const spans = [];
let t0 = 0;

export function startTrace() {
  spans.length = 0;
  t0 = performance.now();
}

export async function span(name, attrs, fn) {
  const parent = als.getStore();
  const s = { id: spans.length + 1, parent: parent?.id ?? null, name, attrs: { ...attrs }, start: performance.now() - t0, ms: 0 };
  spans.push(s);
  try {
    return await als.run(s, () => fn(s));
  } catch (err) {
    s.error = err.message || err.code || String(err);
    throw err;
  } finally {
    s.ms = performance.now() - t0 - s.start;
  }
}

const short = (v) => {
  const t = typeof v === "string" ? v : JSON.stringify(v);
  return t.length > 70 ? t.slice(0, 67) + "..." : t;
};

export function printTrace() {
  const depth = (s) => (s.parent ? depth(spans[s.parent - 1]) + 1 : 0);
  console.log("start (ms)  took (ms)  span");
  for (const s of spans) {
    const attrs = Object.entries(s.attrs).map(([k, v]) => `${k}=${short(v)}`).join("  ");
    const err = s.error ? `  ERROR: ${short(s.error)}` : "";
    console.log(
      `${s.start.toFixed(0).padStart(10)}  ${s.ms.toFixed(0).padStart(9)}  ${"  ".repeat(depth(s))}${s.name}  ${attrs}${err}`,
    );
  }
}

// The same spans as a Mermaid sequence diagram. Every line comes from a real span of this run.
export function toMermaid() {
  const clean = (t) => String(t).replace(/[;#]/g, " ").replace(/\s+/g, " ");
  const kids = (id) => spans.filter((s) => s.parent === id);
  const lines = [
    "sequenceDiagram",
    "  participant A as Agent loop (Day 25)",
    "  participant C as Claude API",
    "  participant T as search_docs tool",
    "  participant E as Embedding model (Day 22)",
    "  participant P as pgvector (Day 23)",
  ];
  const emit = (s) => {
    const ms = `${s.ms.toFixed(0)} ms`;
    if (s.name.startsWith("llm.call")) {
      lines.push(`  A->>C: model call ${s.attrs.step}`);
      lines.push(`  C-->>A: ${clean(s.attrs.stop_reason ?? "no reply")} - ${ms}`);
    } else if (s.name === "tool.search_docs") {
      lines.push(`  A->>T: search_docs ${clean(JSON.stringify(s.attrs.query ?? ""))}`);
      kids(s.id).forEach(emit);
      lines.push(s.error ? `  T--xA: error - ${ms}` : `  T-->>A: top results as text - ${ms}`);
    } else if (s.name === "embed") {
      lines.push("  T->>E: embed the query");
      lines.push(s.error ? "  E--xT: error" : `  E-->>T: vector of ${s.attrs.dims} numbers - ${ms}`);
    } else if (s.name === "pgvector.query") {
      lines.push("  T->>P: top 3 by cosine distance");
      lines.push(s.error ? `  P--xT: ${clean(s.error)} - ${ms}` : `  P-->>T: ${clean(s.attrs.top ?? "")} - ${ms}`);
    } else {
      kids(s.id).forEach(emit);
    }
  };
  spans.filter((s) => s.parent === null).forEach(emit);
  return lines.join("\n") + "\n";
}

export function writeTrace(name) {
  mkdirSync(new URL("./traces/", import.meta.url), { recursive: true });
  writeFileSync(new URL(`./traces/${name}.jsonl`, import.meta.url), spans.map((s) => JSON.stringify(s)).join("\n") + "\n");
  writeFileSync(new URL(`./traces/${name}.mmd`, import.meta.url), toMermaid());
}
