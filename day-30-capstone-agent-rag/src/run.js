// Usage: node run.js ["question"] [runs]
// Runs the question through agent -> search_docs tool -> embedding -> pgvector, prints the trace of each run,
// and writes traces/run-N.jsonl and traces/run-N.mmd (a Mermaid diagram of that run).
import Anthropic from "@anthropic-ai/sdk";
import { runAgent } from "./agent.js";
import { tools } from "./search.js";
import { pool } from "../../day-23-vector-database-pgvector/src/db.js";
import { startTrace, printTrace, writeTrace } from "./trace.js";

// Change here if this model does not work for you (Days 21 and 25 used claude-opus-5-5).
const MODEL = "claude-opus-5-5";
const DEFAULT_QUESTION = "Why do some of my workers sit idle when I add more of them to read the same stream?"; // Day 22, question 1

const question = process.argv[2] ?? DEFAULT_QUESTION;
const runs = Number(process.argv[3] ?? 2);
const client = new Anthropic();

console.log(`model: ${MODEL}\nquestion: ${question}\n`);
for (let n = 1; n <= runs; n++) {
  startTrace();
  let result;
  try {
    result = await runAgent(client, question, { model: MODEL, tools });
  } finally {
    console.log(`--- run ${n}${n === 1 ? " (first run in this process: the embedding model loads now)" : ""}`);
    printTrace();
    writeTrace(`run-${n}`);
  }
  console.log(result.hitLimit ? "answer: STEP LIMIT reached, no answer" : `answer (${result.steps} model calls): ${result.answer}`);
  console.log(`saved: traces/run-${n}.jsonl and traces/run-${n}.mmd\n`);
}
await pool.end();
