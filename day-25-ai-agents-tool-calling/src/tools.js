import { createHash } from "node:crypto";

// What the model sees: a name, a description, and a JSON schema for the arguments.
export const toolDefinitions = [
  {
    name: "hash_text",
    description: "Return the SHA-256 hash (hex) of a text.",
    input_schema: {
      type: "object",
      properties: { input: { type: "string", description: "The text to hash" } },
      required: ["input"],
    },
  },
  {
    name: "count_chars",
    description: "Return the number of characters in a text.",
    input_schema: {
      type: "object",
      properties: { input: { type: "string", description: "The text to count" } },
      required: ["input"],
    },
  },
];

// What actually runs. Each function gets the arguments the model sent.
const implementations = {
  hash_text: ({ input }) => createHash("sha256").update(input).digest("hex"),
  count_chars: ({ input }) => String(input.length),
};

// failing = names of tools that must fail on purpose (Part B).
export function runTool(name, args, failing = []) {
  if (failing.includes(name)) {
    return { isError: true, text: `Error: ${name} is temporarily unavailable.` };
  }
  const fn = implementations[name];
  if (!fn) return { isError: true, text: `Error: unknown tool ${name}.` };
  try {
    return { isError: false, text: fn(args) };
  } catch (err) {
    return { isError: true, text: `Error: ${err.message}` };
  }
}
