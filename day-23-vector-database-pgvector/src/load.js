import { readFileSync } from "node:fs";
import { pool, toVector } from "./db.js";

const { items, dim } = JSON.parse(
  readFileSync(new URL("../../day-22-rag-embeddings/src/vectors.json", import.meta.url))
);

await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
await pool.query("DROP TABLE IF EXISTS docs");
await pool.query(`CREATE TABLE docs (id text PRIMARY KEY, text text, embedding vector(${dim}))`);

for (const it of items) {
  await pool.query("INSERT INTO docs (id, text, embedding) VALUES ($1, $2, $3)", [
    it.id,
    it.text,
    toVector(it.vector),
  ]);
}
const { rows } = await pool.query("SELECT count(*)::int AS n FROM docs");
console.log(`table docs has ${rows[0].n} rows, vector size ${dim}`);
await pool.end();
