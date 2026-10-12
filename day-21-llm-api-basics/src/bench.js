import { Anthropic } from "@anthropic-ai/sdk/client.js";
import { createHash } from "node:crypto";

const client = new Anthropic();
const MODEL = "claude-opus-5-5"; // change here if you use another model
const RUNS = 6;
const MAX_TOKENS = 1024;
const SYSTEM_PROMPT = "You are a concise technical writer.";
const USER_PROMPT = "Explain in about 150 words what a JWT is.";
// No temperature: the API refused it for the models I tried.

async function oneRun() {
  const start = performance.now();
  let firstTokenMs = null;
  let text = "";

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: USER_PROMPT }],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      if (firstTokenMs === null) firstTokenMs = performance.now() - start;
      text += event.delta.text;
    }
  }
  const totalMs = performance.now() - start;
  const final = await stream.finalMessage();

  return {
    firstTokenMs,
    totalMs,
    inTok: final.usage.input_tokens,
    outTok: final.usage.output_tokens,
    blocks: final.content.map((b) => b.type).join(","),
    words: text.trim().split(/\s+/).length,
    hash: createHash("sha256").update(text).digest("hex").slice(0, 8),
    text,
  };
}

const results = [];
console.log(`model: ${MODEL}`);
console.log("run  first_token_ms  total_ms  in_tok  out_tok  words  blocks  hash");
for (let i = 1; i <= RUNS; i++) {
  const r = await oneRun();
  results.push(r);
  console.log(
    [
      String(i).padEnd(4),
      r.firstTokenMs.toFixed(0).padEnd(15),
      r.totalMs.toFixed(0).padEnd(9),
      String(r.inTok).padEnd(7),
      String(r.outTok).padEnd(8),
      String(r.words).padEnd(6),
      r.blocks.padEnd(7),
      r.hash,
    ].join(" ")
  );
}

const unique = new Set(results.map((r) => r.hash)).size;
console.log(`\nunique answers: ${unique} of ${RUNS}`);
console.log("\nrun 1 starts:", JSON.stringify(results[0].text.slice(0, 160)));
console.log("run 2 starts:", JSON.stringify(results[1].text.slice(0, 160)));
