import { Anthropic } from "@anthropic-ai/sdk/client.js";

// Defining standard models to use
const availableModels = {
  haiku: "claude-haiku-5-5", // Low cost and efficient for general purpose like summarising, content generation
  Sonnet: "claude-sonnet-5-5", // medium cost and balanced for specific needs like thinking
  opus: "claude-opus-5-5", // expensive for complex execution tasks
};

const client = new Anthropic();
const MODEL = availableModels.opus;
const TEMPERATURE = 0;
const MAX_TOKENS = 1024;

const SYSTEM_PROMPT =
  "You are a concise technical writer, generate a simple 100 word context on the topic:"; // system prompt

const USER_PROMPT = "Anthropic"; // Can have any topics such as Agentic AI, MCP, workflows, etc

const stream = client.messages.stream({
  max_tokens: MAX_TOKENS,
  system: SYSTEM_PROMPT,
  messages: [{ role: "user", content: USER_PROMPT }],
  model: MODEL,
  // temperature: TEMPERATURE, // `temperature` is deprecated for this model. for haiku, sonnet
});

// Streaming the message string
for await (const event of stream) {
  if (
    event.type === "content_block_delta" &&
    event.delta.type === "text_delta"
  ) {
    process.stdout.write(event.delta.text);
  }
}

const final = await stream.finalMessage();
console.log(
  "\ninput_tokens:",
  final.usage.input_tokens,
  "output_tokens:",
  final.usage.output_tokens,
);
