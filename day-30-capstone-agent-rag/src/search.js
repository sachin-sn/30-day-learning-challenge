// The tool the agent gets: it uses the Day 22 embedding code and the Day 23 pgvector table
// (both imported from their own folders, not copied).
import { embed } from "../../day-23-vector-database-pgvector/src/embed.js";
import { pool, toVector } from "../../day-23-vector-database-pgvector/src/db.js";
import { span } from "./trace.js";

// Same query as Day 23: <=> is cosine distance, so similarity = 1 - distance.
const SQL = `SELECT id, text, 1 - (embedding <=> $1) AS score
             FROM docs
             WHERE id NOT LIKE 'rand-%'
             ORDER BY embedding <=> $1
             LIMIT 3`;

const definitions = [
  {
    name: "search_docs",
    description: "Search my short engineering notes (JWT, Kafka, Redis, Docker, rate limiting, OpenTelemetry, Kubernetes, Terraform, gRPC, WebSocket). Returns the 3 closest notes with a similarity score.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "What to look up, in plain words" } },
      required: ["query"],
    },
  },
];

async function searchDocs({ query }) {
  return span("tool.search_docs", { query }, async () => {
    const qv = await span("embed", { model: "Xenova/all-MiniLM-L6-v2" }, async (s) => {
      const v = await embed(query);
      s.attrs.dims = v.length;
      return v;
    });
    const rows = await span("pgvector.query", { limit: 3 }, async (s) => {
      const { rows } = await pool.query(SQL, [toVector(qv)]);
      s.attrs.top = rows.map((r) => `${r.id} ${Number(r.score).toFixed(3)}`).join(", ");
      return rows;
    });
    return {
      isError: false,
      text: rows.map((r) => `[${r.id}] (score ${Number(r.score).toFixed(3)}) ${r.text}`).join("\n"),
    };
  });
}

export const tools = {
  definitions,
  async run(name, args) {
    if (name !== "search_docs") return { isError: true, text: `Error: unknown tool ${name}.` };
    try {
      return await searchDocs(args);
    } catch (err) {
      return { isError: true, text: `Error: ${err.message || err.code || String(err)}` };
    }
  },
};
