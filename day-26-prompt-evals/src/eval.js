import { readFileSync } from "node:fs";
import { LABELS, PROMPTS } from "./prompts.js";

const MODEL = "claude-haiku-5-5"; // change if the model is rejected (Days 21 and 25 used claude-opus-5-5)
const cases = JSON.parse(
  readFileSync(new URL("./cases.json", import.meta.url)),
);

export async function classify(client, system, text) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: text }],
  });
  return res.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// One full pass over all cases. Returns the score and the per-case answers.
export async function runOnce(client, system) {
  const rows = [];
  for (const c of cases) {
    const raw = await classify(client, system, c.text);
    const got = raw.toLowerCase();
    rows.push({
      id: c.id,
      expected: c.expected,
      raw,
      ok: got === c.expected,
      valid: LABELS.includes(got),
    });
  }
  return { score: rows.filter((r) => r.ok).length, rows };
}

// Only run the CLI when this file is started directly (not when imported by a test).
if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const version = process.argv[2] ?? "v1";
  const repeats = Number(process.argv[3] ?? 1);
  if (!PROMPTS[version]) {
    console.error(
      `unknown prompt version "${version}". Use one of: ${Object.keys(PROMPTS).join(", ")}`,
    );
    process.exit(1);
  }
  const client = new Anthropic();
  console.log(`model: ${MODEL}   prompt: ${version}   runs: ${repeats}\n`);

  const runs = [];
  for (let n = 1; n <= repeats; n++) {
    const run = await runOnce(client, PROMPTS[version]);
    runs.push(run);
    console.log(`--- run ${n}: score ${run.score} / ${cases.length}`);
    for (const r of run.rows) {
      const note = r.ok ? "ok" : r.valid ? "WRONG" : "NOT A LABEL";
      console.log(
        `  #${String(r.id).padEnd(2)} expected ${r.expected.padEnd(16)} got ${JSON.stringify(r.raw).padEnd(20)} ${note}`,
      );
    }
  }
  console.log(`\nscores: ${runs.map((r) => r.score).join(", ")}`);
  if (runs.length > 1) {
    const changed = cases
      .filter(
        (c, i) =>
          new Set(runs.map((r) => r.rows[i].raw.toLowerCase())).size > 1,
      )
      .map((c) => c.id);
    console.log(
      `cases whose answer changed between runs: ${changed.length ? changed.join(", ") : "none"}`,
    );
  }
}
