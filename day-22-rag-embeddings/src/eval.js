import { readFileSync } from "node:fs";
import { embed, topK } from "./embed.js";

const { model, items } = JSON.parse(readFileSync(new URL("./vectors.json", import.meta.url)));
const questions = JSON.parse(readFileSync(new URL("./questions.json", import.meta.url)));
console.log(`model: ${model}\n`);

let hits = 0;
for (const [n, { q, expected }] of questions.entries()) {
  const t = performance.now();
  const qv = await embed(q);
  const ms = performance.now() - t;
  const top = topK(qv, items, 3);
  const hit = top.some((r) => r.id === expected);
  if (hit) hits++;
  console.log(`Q${n + 1}: ${q}`);
  console.log(`  expected: ${expected}   script says: ${hit ? "HIT" : "MISS"}   (${ms.toFixed(0)} ms)`);
  for (const [i, r] of top.entries()) {
    console.log(`  ${i + 1}. ${r.score.toFixed(3)}  [${r.id}] ${r.text.slice(0, 70)}...`);
  }
  console.log();
}
console.log(`script count: ${hits} of ${questions.length} in top 3 (my own reading is the result)`);
