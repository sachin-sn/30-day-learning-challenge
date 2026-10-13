import { readFileSync, writeFileSync } from "node:fs";
import { MODEL, loadModel, embed, topK } from "./embed.js";

const docs = JSON.parse(readFileSync(new URL("./docs.json", import.meta.url)));
const question = process.argv[2];
if (!question) {
  console.error('usage: node search.js "your question"');
  process.exit(1);
}

let t = performance.now();
await loadModel();
console.log(`model: ${MODEL}`);
console.log(`model load: ${(performance.now() - t).toFixed(0)} ms`);

t = performance.now();
const items = [];
for (const d of docs) items.push({ ...d, vector: await embed(d.text) });
console.log(`embedded ${items.length} texts: ${(performance.now() - t).toFixed(0)} ms`);
console.log(`vector size: ${items[0].vector.length}`);
console.log("first 5 numbers of the first vector:", items[0].vector.slice(0, 5).map((x) => +x.toFixed(4)));

writeFileSync(
  new URL("./vectors.json", import.meta.url),
  JSON.stringify({ model: MODEL, dim: items[0].vector.length, items })
);
console.log("wrote vectors.json");

const qv = await embed(question);
console.log(`\nquestion: ${question}`);
for (const [i, r] of topK(qv, items, 3).entries()) {
  console.log(`${i + 1}. ${r.score.toFixed(3)}  [${r.id}] ${r.text.slice(0, 80)}...`);
}
