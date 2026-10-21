// The Day 25 loop, with two changes: the tool call is async (it talks to a database), and every
// model call and tool call is wrapped in a trace span.
import { span } from "./trace.js";

const SYSTEM =
  "You answer questions about backend engineering topics. Use the search_docs tool to look up my notes before answering, and base your answer on what it returns. If the notes do not cover the question, say so. Keep answers short.";

export async function runAgent(client, question, { model, maxSteps = 5, tools }) {
  const messages = [{ role: "user", content: question }];
  return span("agent.request", { question, model }, async (root) => {
    for (let step = 1; step <= maxSteps; step++) {
      const response = await span(`llm.call ${step}`, { step }, async (s) => {
        const r = await client.messages.create({
          model,
          max_tokens: 2048,
          system: SYSTEM,
          tools: tools.definitions,
          messages,
        });
        s.attrs.stop_reason = r.stop_reason;
        s.attrs.in_tokens = r.usage.input_tokens;
        s.attrs.out_tokens = r.usage.output_tokens;
        return r;
      });

      const toolUses = response.content.filter((b) => b.type === "tool_use");
      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        const answer = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
        root.attrs.steps = step;
        return { steps: step, answer, hitLimit: false };
      }

      messages.push({ role: "assistant", content: response.content });
      const results = [];
      for (const tu of toolUses) {
        const r = await tools.run(tu.name, tu.input);
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: r.text,
          ...(r.isError ? { is_error: true } : {}),
        });
      }
      messages.push({ role: "user", content: results });
    }
    root.attrs.steps = maxSteps;
    root.attrs.hit_limit = true;
    return { steps: maxSteps, answer: null, hitLimit: true };
  });
}
