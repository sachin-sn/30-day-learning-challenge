import { pool } from "./db.js";

const action = process.argv[2];
if (action === "create") {
  const t = performance.now();
  await pool.query("CREATE INDEX docs_hnsw ON docs USING hnsw (embedding vector_cosine_ops)");
  console.log(`created HNSW index in ${((performance.now() - t) / 1000).toFixed(1)} s`);
} else if (action === "drop") {
  await pool.query("DROP INDEX IF EXISTS docs_hnsw");
  console.log("dropped index");
} else {
  console.log("usage: node index.js create | drop");
}
await pool.end();
