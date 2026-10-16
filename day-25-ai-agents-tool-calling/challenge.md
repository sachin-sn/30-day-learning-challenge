# Day 25 — AI Agent Loop: Two Tools, Five Steps, One Failure

**Time box:** 90 minutes. Part A about 40 min, Part B about 30 min, notes about 15 min.
If a part runs over by 15 minutes, stop, write down where you stopped, and move on.
**Tech stack:** Node.js 22, `@anthropic-ai/sdk`, JavaScript with ES modules (uses the API credit from Day 21; today costs a few cents)

## Why this matters

You built agentic AI at Diligent, and "how does an agent loop work, and what happens when a tool fails?"
is a standard interview question. Today you read a complete agent loop that is about 50 lines long, run it
on three tasks, and then make one tool fail on purpose to see what the model does.

## Predictions (write these first, 5 min)

Put them in `solution.md` before you run any code.

1. Task 3 asks the agent to hash three words and compare the hashes. How many steps (calls to the model)
   will it take, counting the final answer? (A number.)
2. In Part B the tool `count_chars` fails every time. After the first error, what will the agent do:
   (a) call the same tool again, (b) answer without the tool, or (c) stop and tell you it failed?
   Say which.

## Part A — Build it (about 40 min)

The starter code is ready in `src/`: `tools.js` (two tools), `agent.js` (the loop) and `run.js` (three tasks).

1. In `src/`: `npm install`. Make sure `ANTHROPIC_API_KEY` is set in your shell (never in a file).
2. Read `agent.js` line by line. Find: where the model's request for a tool is detected, where the tool runs,
   where the result goes back to the model, and where the loop stops. Be ready to draw it on a whiteboard:
   model reply -> run tool -> add result -> model reply -> ...
3. `node run.js` runs the three tasks and prints every tool call and a summary table.
   If the model name is rejected, change `MODEL` at the top of `run.js` (Day 21 used `claude-opus-5-5`).

Done looks like: all three tasks have an answer, and you know the steps and tool calls for each.

## Part B — Break it (about 30 min)

1. `node run.js fail` runs task 2 ("hash 'hello', then count the characters of the hash") with `count_chars`
   returning an error every time. Read the log: what did the agent do after the first error?
2. Optional: change `MAX_STEPS` in `run.js` to 2 and run `node run.js` again. What happens to the tasks that
   need more steps? Put it back afterwards.

## Save this output

- The log and summary table of `node run.js` (steps, tool calls and tokens per task)
- The log and answer of `node run.js fail`, and which of (a), (b), (c) the agent did
- If you did the optional step: which tasks hit the limit

## Not part of today

Memory between runs, parallel agents, planning prompts, and frameworks (LangChain and similar). Do not add
more tools. Do not tune the system prompt until the first runs are saved.

## Resources

- https://docs.anthropic.com/en/docs/build-with-claude/tool-use
