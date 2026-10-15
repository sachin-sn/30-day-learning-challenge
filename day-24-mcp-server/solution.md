# Day 24 — Solution: MCP Server with Two Tools

> Status: done (docs link and the console.error answer still TODO; Claude Desktop not tried).

## Predictions (written before the work)

1. Calling `hash` with a number (`123`): a thrown protocol error, or a normal response that carries an error flag?
   Prediction: "A normal response that carries an error flag" — result: right. All three bad calls (a number, no argument, an unknown tool) came back as normal responses with `"isError": true`, and none was thrown.
2. How many milliseconds does one tool call take over stdio on my Mac?
   Prediction: "20ms" — result: wrong. The calls took 0.5 to 4.6 ms. Connecting (starting the server) took 151.4 ms.

## Output

`node client.js` (real output, trimmed):

```
day24-mcp server starting
connected in 151.4 ms

tools/list  (4.1 ms)
  hash  "Return the SHA-256 hash (hex) of a text."
        inputSchema: { type: object, properties: { input: { type: string, description: "The text to hash" } }, required: ["input"] }
  info  "Return information about this server process: instance id, calls so far, version."
        inputSchema: { type: object, properties: {} }

call 1: hash {"input":"abc"}        (4.6 ms)
  content[0].text: {"input":"abc","sha256":"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"}
call 2: info {}                     (0.8 ms)
  content[0].text: {"instanceId":"df0e488a-f35f-4dbd-8419-b2f4a4b46f38","requestCount":2,"initMs":0.1474589999999978,"version":"v1"}
call 3: hash {"input":"abc"}        (0.5 ms)
  content[0].text: same as call 1

BAD: hash {"input":123}             (1.2 ms)
  isError: true
  text: MCP error -32602: Input validation error: Invalid arguments for tool hash: Invalid input: expected string, received number at input
BAD: hash {}                        (0.7 ms)
  isError: true
  text: MCP error -32602: Input validation error: Invalid arguments for tool hash: Invalid input: expected string, received undefined at input
BAD: nope {}                        (0.5 ms)
  isError: true
  text: MCP error -32602: Tool nope not found
```

| call                        | time     |
| --------------------------- | -------- |
| connect (starts the server) | 151.4 ms |
| tools/list                  | 4.1 ms   |
| hash                        | 4.6 ms   |
| info                        | 0.8 ms   |
| hash (again)                | 0.5 ms   |
| bad: number                 | 1.2 ms   |
| bad: no argument            | 0.7 ms   |
| bad: unknown tool           | 0.5 ms   |

The first tool call (4.6 ms) was the slowest of the calls. The `sha256` of "abc" is the standard SHA-256 test value, which I did not check myself.

### MCP Inspector (optional step, screenshot)

`npx @modelcontextprotocol/inspector node server.js` (Inspector v0.15.0, transport STDIO, command `node`, arguments `server.js`), status Connected.
The History panel shows 4 messages in order: `1. initialize`, `2. tools/list`, `3. tools/call`, `4. tools/call`.
The Tools tab lists `hash` and `info`. Running `info` shows Tool Result: Success with
`requestCount: 2`, `initMs: 0.15116700000000094`, `version: "v1"` and an `instanceId`.
The panel "Error output from MCP server" shows `day24-mcp server starting`, which is the `console.error` line from `server.js`.

## What I learned (3 sentences at most)

All three bad calls came back as normal responses with `isError: true` and a message that starts with the code -32602, so my prediction was right. A tool call over stdio took 0.5 to 4.6 ms, much less than my 20 ms, and starting the server took 151 ms. The `zod` schema in `server.js` became the `inputSchema` that the client sees in `tools/list`, with `input` marked required.

## Not measured / still open

- Claude Desktop: not tried, so I did not see how an AI app calls the tools. The Inspector step was done (see above).
- Why `server.js` logs with `console.error` and not `console.log`: TODO (my own answer, after reading the file).
- I did not check what the MCP spec says about an unknown tool or invalid arguments. This SDK returns them as `isError` responses, and I do not know if other versions or servers do the same.
- One run, one machine, one client. Times are for a local child process over stdio, not over a network.

## Link

- reference: https://modelcontextprotocol.io/docs/2026-07-28/getting-started/intro
