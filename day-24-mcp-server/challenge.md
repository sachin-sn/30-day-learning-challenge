# Day 24 — MCP Server: Two Tools, One Client, One Bad Call

**Time box:** 90 minutes. Part A about 40 min, Part B about 30 min, notes about 15 min.
If a part runs over by 15 minutes, stop, write down where you stopped, and move on.
**Tech stack:** Node.js 22, `@modelcontextprotocol/sdk`, `zod`, JavaScript with ES modules

## Why this matters

MCP (Model Context Protocol) is how an AI app like Claude Desktop calls your code: your program
lists its tools, and the AI app calls them with JSON arguments. "What is MCP and how would you
expose an internal API through it?" is a likely interview question. Today you wrap the `/hash` and
`/info` logic from Days 15 to 17 as two MCP tools, and you look at the real messages.

## Predictions (write these first, 5 min)

Put them in `solution.md` before you run any code.

1. In Part B you call `hash` with a number (`123`) where it expects a string. What comes back:
   (a) a thrown protocol error, or (b) a normal response that carries an error flag? Say which.
2. How many milliseconds does one tool call take, from the client sending it to getting the answer,
   over stdio on your Mac? (One number; a guess is fine.)

## Part A — Build it (about 40 min)

The starter code is ready in `src/`: `server.js` (the two tools) and `client.js` (a small client that
starts the server and calls it). Your job is to read both files and understand every line, then run them.

1. In `src/`: `npm install`.
2. Read `server.js`. Find: where each tool is named and described, where the argument is declared
   (the `zod` line), and why the server writes its log line with `console.error` and not `console.log`.
3. Run `node client.js`. It starts the server as a child process, asks for the tool list, and makes
   three good calls (`hash`, `info`, `hash` again).

Done looks like: the tool list shows both tools with their input schema, and you can see the answers.

## Part B — Break it, and look (about 30 min)

The same `client.js` also makes three bad calls: `hash` with a number, `hash` with no argument,
and a tool that does not exist.

1. Look at the output for each bad call. Is it a thrown error or a normal response with an error flag?
2. Note the time of each call (the `ms` in the response lines). The first call is often slower than the rest.
3. Optional, if time is left: connect the same server to the MCP Inspector
   (`npx @modelcontextprotocol/inspector node server.js`, from `src/`) or to Claude Desktop, and call
   `hash` once from there. Paste what you see. If you skip this, write "not done".

## Save this output

- The tool list (names and input schemas)
- The request and response of each of the three good calls
- The request and response (or error) of each of the three bad calls
- The time for each call, and the connect time

## Not part of today

HTTP transport, authentication, resources and prompts (the other two MCP features), and deploying the
server. Do not add more tools.

## Resources

- https://modelcontextprotocol.io
- https://github.com/modelcontextprotocol/typescript-sdk
