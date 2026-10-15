import { createHash, randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Same logic as the /hash and /info routes from Days 15-17.
const t0 = performance.now();
const instanceId = randomUUID(); // made once per server process
let requestCount = 0;
const initMs = performance.now() - t0;

const server = new McpServer({ name: "day24-mcp", version: "1.0.0" });

const asText = (data) => ({ content: [{ type: "text", text: JSON.stringify(data) }] });

server.registerTool(
  "hash",
  {
    description: "Return the SHA-256 hash (hex) of a text.",
    inputSchema: { input: z.string().describe("The text to hash") },
  },
  async ({ input }) => {
    requestCount++;
    return asText({ input, sha256: createHash("sha256").update(input).digest("hex") });
  }
);

server.registerTool(
  "info",
  {
    description: "Return information about this server process: instance id, calls so far, version.",
    inputSchema: {},
  },
  async () => {
    requestCount++;
    return asText({ instanceId, requestCount, initMs, version: "v1" });
  }
);

// stdout is the protocol channel: never console.log here. Log to stderr only.
console.error("day24-mcp server starting");
await server.connect(new StdioServerTransport());
