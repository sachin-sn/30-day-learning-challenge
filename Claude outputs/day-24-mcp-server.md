---
title: "Day 24 — Three Bad Calls to an MCP Server, and None of Them Threw"
date: "2026-10-15"
excerpt: "I wrapped my /hash and /info logic as two MCP tools and called them from a small client and from the MCP Inspector. A number instead of a string, a missing argument and an unknown tool all came back as normal responses with an error flag, in under 2 ms."
tags: ["30-day-challenge", "day-24", "mcp", "model-context-protocol", "nodejs", "tools"]
draft: true
---

Day 23 stored vectors in a database. Day 24 goes to the other side of an AI app:
how it calls your code. MCP, the Model Context Protocol, is how an app like
Claude Desktop asks a program for its tools and then calls them with JSON
arguments. I took the `/hash` and `/info` logic from Days 15 to 17 and exposed it as
two MCP tools. It is the short 90-minute format again.

## What I built

The starter code came with the challenge: a `server.js` with two tools and a
`client.js` that starts the server and calls it. The server is the MCP SDK with
`zod` for the argument. `hash` takes a string `input` and returns its SHA-256 in
hex. `info` takes nothing and returns an instance id, a call count and a version.
The `zod` line is what the client later sees as the `inputSchema` in `tools/list`,
with `input` marked required. The server talks over stdio: the client starts it
as a child process.

Two predictions came first. My first was that a call with a wrong argument type
would come back as a normal response with an error flag. My second was that one
tool call would take 20 ms.

## Three good calls

```
connect (starts the server)   151.4 ms
tools/list                      4.1 ms
hash {"input":"abc"}            4.6 ms
info {}                         0.8 ms
hash {"input":"abc"}            0.5 ms
```

My 20 ms was wrong. The calls took 0.5 to 4.6 ms. The only number close to my
guess is starting the server, which took 151 ms. The first call was the slowest,
and I do not know why. This is one run, one machine, a local child process, so it
says nothing about a call over a network.

## Three bad calls

```
hash {"input":123}        isError: true   Input validation error: ... expected string, received number at input
hash {}                   isError: true   Input validation error: ... expected string, received undefined at input
nope {}                   isError: true   Tool nope not found
```

My prediction was right. None of the three was thrown as an exception in my
client. Each came back as a normal response with `isError: true`, and the message
text starts with the code -32602. Each took 0.5 to 1.2 ms. I did not check what
the MCP spec says about unknown tools or invalid arguments. This SDK returns both
as an error response, and I do not know if other servers do the same.

## Looking at it in the Inspector

I also ran `npx @modelcontextprotocol/inspector node server.js`. It connected over
STDIO and showed both tools with their descriptions. The History panel listed four
messages in order: `initialize`, `tools/list`, and two `tools/call`. Running `info`
returned Success with a call count of 2. I did not connect Claude Desktop, so I
have not seen an AI app call the tools.

## The console.error line

The server logs with `console.error` and not `console.log`. A comment at the top of
`server.js` says stdout is the protocol channel. With stdio, the client writes
messages to the server's stdin and reads the answers from its stdout, one JSON
message per line. stderr is a separate channel, and the Inspector shows it in a
panel called "Error output from MCP server". My log line "day24-mcp server
starting" was there. A test copy with `console.log` still worked with my client,
and that test was run by Claude, not by me. So I would not rely on it breaking
loudly. I did not try other clients.

## What I'm leaving open

Claude Desktop. HTTP transport, authentication, resources and prompts. I did not
check the spec for how errors should be reported. One run on one machine.

## What's next

Day 25 is an AI agent with two tools and a limit of five steps, which uses the LLM
API again. Full code in the [repo](#) — `day-24-mcp-server/`.
