import { pool, toVector } from "./db.js";

const N = 20000;
const DIM = 384;
const rand = () => Array.from({ length: DIM }, () => Math.random() - 0.5);

await pool.query("DELETE FROM docs WHERE id LIKE 'rand-%'");
const t = performance.now();
const client = await pool.connect();
await client.query("BEGIN");
for (let i = 0; i < N; i++) {
  await client.query("INSERT INTO docs (id, text, embedding) VALUES ($1, 'synthetic', $2)", [
    `rand-${i}`,
    toVector(rand()),
  ]);
}
await client.query("COMMIT");
client.release();
const { rows } = await pool.query("SELECT count(*)::int AS n FROM docs");
console.log(`added ${N} random vectors in ${((performance.now() - t) / 1000).toFixed(1)} s; table has ${rows[0].n} rows`);
await pool.end();
