import { toolDefinitions, runTool } from "./tools.js";

const SYSTEM = "You are a helpful assistant. Use the tools when they help. Keep answers short.";

// One step = one call to the model. The loop stops when the model answers without
// asking for a tool, or when maxSteps is reached.
export async function runAgent(client, task, { model, maxSteps = 5, failing = [] } = {}) {
  const messages = [{ role: "user", content: task }];
  const log = [];
  let inputTokens = 0;
  let outputTokens = 0;

  for (let step = 1; step <= maxSteps; step++) {
    const response = await client.messages.create({
      model,
      max_tokens: 2048,
      system: SYSTEM,
      tools: toolDefinitions,
      messages,
    });
    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;

    const toolUses = response.content.filter((b) => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      const text = response.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("");
      return { steps: step, log, answer: text, hitLimit: false, inputTokens, outputTokens };
    }

    // Keep the model's full reply (including any thinking blocks) in the history.
    messages.push({ role: "assistant", content: response.content });

    const results = [];
    for (const tu of toolUses) {
      const r = runTool(tu.name, tu.input, failing);
      log.push({ step, tool: tu.name, args: tu.input, result: r.text, isError: r.isError });
      results.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: r.text,
        ...(r.isError ? { is_error: true } : {}),
      });
    }
    messages.push({ role: "user", content: results });
  }

  return { steps: maxSteps, log, answer: null, hitLimit: true, inputTokens, outputTokens };
}
