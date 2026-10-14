import { readFileSync } from "node:fs";
import { pool, toVector } from "./db.js";
import { embed, topK } from "./embed.js";

const { items } = JSON.parse(
  readFileSync(new URL("../../day-22-rag-embeddings/src/vectors.json", import.meta.url))
);
const questions = JSON.parse(readFileSync(new URL("./questions.json", import.meta.url)));

// <=> is cosine distance in pgvector, so similarity = 1 - distance.
const SQL = `SELECT id, 1 - (embedding <=> $1) AS score
             FROM docs
             WHERE id NOT LIKE 'rand-%'
             ORDER BY embedding <=> $1
             LIMIT 3`;

let same = 0;
for (const [n, { q }] of questions.entries()) {
  const qv = await embed(q);
  const db = (await pool.query(SQL, [toVector(qv)])).rows;
  const mem = topK(qv, items, 3);
  const dbIds = db.map((r) => r.id).join(" > ");
  const memIds = mem.map((r) => r.id).join(" > ");
  const isSame = dbIds === memIds;
  if (isSame) same++;
  console.log(`Q${n + 1}: ${q}`);
  console.log(`  pgvector: ${db.map((r) => `${r.id} ${Number(r.score).toFixed(3)}`).join(" | ")}`);
  console.log(`  Day 22  : ${mem.map((r) => `${r.id} ${r.score.toFixed(3)}`).join(" | ")}`);
  console.log(`  ${isSame ? "SAME" : "DIFFERENT"}\n`);
}
console.log(`same top 3 (ids and order): ${same} of ${questions.length}`);
await pool.end();
