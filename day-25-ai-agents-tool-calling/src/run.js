import Anthropic from "@anthropic-ai/sdk";
import { runAgent } from "./agent.js";

// Change here if this model does not work for you (Day 21 used claude-opus-5-5).
const MODEL = "claude-opus-5-5";
const MAX_STEPS = 5;

const TASKS = [
  { id: 1, text: "What is the SHA-256 hash of the word 'abc'?" },
  {
    id: 2,
    text: "Hash the word 'hello', then tell me how many characters the hash has.",
  },
  {
    id: 3,
    text: "Hash the words 'a', 'b' and 'c' separately. Which of the three hashes starts with the lowest hex digit?",
  },
];

const mode = process.argv[2]; // "fail" runs task 2 with count_chars failing
const client = new Anthropic();

async function runOne(task, failing) {
  console.log(
    `\n=== Task ${task.id}${failing.length ? ` (failing on purpose: ${failing.join(", ")})` : ""}: ${task.text}`,
  );
  const r = await runAgent(client, task.text, {
    model: MODEL,
    maxSteps: MAX_STEPS,
    failing,
  });
  for (const c of r.log) {
    console.log(
      `  step ${c.step}: ${c.tool}(${JSON.stringify(c.args)}) -> ${c.isError ? "ERROR " : ""}${c.result}`,
    );
  }
  console.log(
    r.hitLimit
      ? `  STEP LIMIT (${MAX_STEPS}) reached, no final answer`
      : `  answer (step ${r.steps}): ${r.answer}`,
  );
  return {
    task: task.id,
    failing: failing.join(",") || "-",
    steps: r.steps,
    toolCalls: r.log.length,
    inTok: r.inputTokens,
    outTok: r.outputTokens,
    hitLimit: r.hitLimit,
  };
}

const rows = [];
if (mode === "fail") {
  rows.push(await runOne(TASKS[1], ["count_chars"]));
} else {
  for (const t of TASKS) rows.push(await runOne(t, []));
}

console.log(`\nmodel: ${MODEL}, max steps: ${MAX_STEPS}`);
console.log("task  failing      steps  tool_calls  in_tok  out_tok  hit_limit");
for (const r of rows) {
  console.log(
    [
      String(r.task).padEnd(5),
      r.failing.padEnd(12),
      String(r.steps).padEnd(6),
      String(r.toolCalls).padEnd(11),
      String(r.inTok).padEnd(7),
      String(r.outTok).padEnd(8),
      r.hitLimit,
    ].join(" "),
  );
}
