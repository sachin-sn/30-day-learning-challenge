import { pool, toVector } from "./db.js";
import { embed } from "./embed.js";

const QUESTION = "How do I keep compilers and dev tools out of the container I ship?";
const RUNS = 20;
const SQL = `SELECT id FROM docs ORDER BY embedding <=> $1 LIMIT 3`;

const v = toVector(await embed(QUESTION));
await pool.query(SQL, [v]); // one warm-up call, not counted

const times = [];
for (let i = 0; i < RUNS; i++) {
  const t = performance.now();
  await pool.query(SQL, [v]);
  times.push(performance.now() - t);
}
times.sort((a, b) => a - b);
const rows = (await pool.query("SELECT count(*)::int AS n FROM docs")).rows[0].n;
const idx = (await pool.query("SELECT indexname FROM pg_indexes WHERE tablename = 'docs'")).rows
  .map((r) => r.indexname)
  .join(", ");
console.log(`rows: ${rows}   indexes: ${idx}`);
console.log(`${RUNS} runs: min ${times[0].toFixed(1)} ms   median ${times[RUNS / 2].toFixed(1)} ms   max ${times[RUNS - 1].toFixed(1)} ms`);

const plan = await pool.query(`EXPLAIN (ANALYZE) ${SQL}`, [v]);
console.log("\nplan:");
for (const r of plan.rows) console.log("  " + r["QUERY PLAN"]);
await pool.end();
