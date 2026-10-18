// Day 27: run the Day 26 test cases on a local model (Ollama) or on the Claude API, and time each call.
// The cases and prompts are NOT copied: they are read from ../../day-26-prompt-evals/src.
//
// Usage:
//   node run.js ollama <model> <v1|v2> [repeats]     e.g. node run.js ollama llama3.2:3b v1 2
//   node run.js api <v1|v2> [repeats]                (needs ANTHROPIC_API_KEY in the shell and npm install)
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const day26 = path.join(here, "..", "..", "day-26-prompt-evals", "src");
const cases = JSON.parse(readFileSync(path.join(day26, "cases.json"), "utf8"));
const { LABELS, PROMPTS } = await import(pathToFileURL(path.join(day26, "prompts.js")).href);

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const API_MODEL = "claude-haiku-5-5"; // same model as the Day 26 main runs

// Each backend returns { raw, extra } for one message. Settings are defaults, same as Day 26,
// except num_predict: 100 for Ollama so a model that rambles cannot run for minutes.
function ollamaBackend(model) {
  return async (system, text) => {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        options: { num_predict: 100 },
        messages: [
          { role: "system", content: system },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Ollama returned ${res.status}: ${await res.text()}`);
    const j = await res.json();
    return {
      raw: (j.message?.content ?? "").trim(),
      extra: { loadMs: (j.load_duration ?? 0) / 1e6, outTokens: j.eval_count },
    };
  };
}

async function apiBackend() {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  return async (system, text) => {
    const res = await client.messages.create({
      model: API_MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: text }],
    });
    const raw = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    return { raw, extra: { outTokens: res.usage?.output_tokens } };
  };
}

export async function runOnce(call, system) {
  const rows = [];
  const t0 = performance.now();
  for (const c of cases) {
    const t = performance.now();
    const { raw, extra } = await call(system, c.text);
    const ms = performance.now() - t;
    const got = raw.toLowerCase();
    rows.push({ id: c.id, expected: c.expected, raw, ok: got === c.expected, valid: LABELS.includes(got), ms, ...extra });
  }
  return { score: rows.filter((r) => r.ok).length, totalMs: performance.now() - t0, rows };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, ...rest] = process.argv.slice(2);
  let call, label, version, repeats;
  if (mode === "ollama") {
    const [model, v = "v1", r = "1"] = rest;
    if (!model) { console.error("usage: node run.js ollama <model> <v1|v2> [repeats]"); process.exit(1); }
    call = ollamaBackend(model); label = `ollama ${model}`; version = v; repeats = Number(r);
  } else if (mode === "api") {
    const [v = "v1", r = "1"] = rest;
    call = await apiBackend(); label = `api ${API_MODEL}`; version = v; repeats = Number(r);
  } else {
    console.error("usage: node run.js ollama <model> <v1|v2> [repeats]  |  node run.js api <v1|v2> [repeats]");
    process.exit(1);
  }
  if (!PROMPTS[version]) { console.error(`unknown prompt "${version}". Use: ${Object.keys(PROMPTS).join(", ")}`); process.exit(1); }

  console.log(`backend: ${label}   prompt: ${version}   runs: ${repeats}\n`);
  const runs = [];
  for (let n = 1; n <= repeats; n++) {
    const run = await runOnce(call, PROMPTS[version]);
    runs.push(run);
    console.log(`--- run ${n}: score ${run.score} / ${cases.length}   total ${(run.totalMs / 1000).toFixed(1)} s`);
    for (const r of run.rows) {
      const note = r.ok ? "ok" : r.valid ? "WRONG" : "NOT A LABEL";
      const load = r.loadMs > 100 ? `  (model load ${(r.loadMs / 1000).toFixed(1)} s)` : "";
      console.log(
        `  #${String(r.id).padEnd(2)} expected ${r.expected.padEnd(16)} got ${JSON.stringify(r.raw.slice(0, 40)).padEnd(24)} ${note.padEnd(11)} ${String(Math.round(r.ms)).padStart(6)} ms${load}`,
      );
    }
  }
  console.log(`\nscores: ${runs.map((r) => r.score).join(", ")}`);
  console.log(`total seconds: ${runs.map((r) => (r.totalMs / 1000).toFixed(1)).join(", ")}`);
  if (runs.length > 1) {
    const changed = cases.filter((c, i) => new Set(runs.map((r) => r.rows[i].raw.toLowerCase())).size > 1).map((c) => c.id);
    console.log(`cases whose answer changed between runs: ${changed.length ? changed.join(", ") : "none"}`);
  }
}
