---
title: "Day 25 — I Guessed 15 Steps. The Agent Needed 7, and It Did Not Retry the Failing Tool"
date: "2026-10-16"
excerpt: "I read a 50-line agent loop, ran it on three tasks, and then made one of its two tools fail on purpose. The tasks took 2, 3 and 2 steps, and after the failure the agent answered without the tool."
tags: ["30-day-challenge", "day-25", "ai-agents", "tool-calling", "claude-api", "nodejs"]
draft: true
---

Day 24 exposed tools to an AI app through MCP. Day 25 looks at the other side of
that call: the loop in the AI app that decides to use a tool, runs it, and goes back
to the model. I built agentic features at work, but I had not looked at the bare
loop in a while. It is the short 90-minute format again.

## The loop

The starter code came with the challenge, written by Claude, and my job was to read
it and run it. It has two tools, `hash_text` (SHA-256 of a text) and `count_chars`,
and a loop with a limit of 5 steps. One step is one call to the model. The loop
does this: send the messages and the tool list to the model, and if the reply asks
for a tool, run it, add the result as a message, and call the model again. It
stops when the model answers without asking for a tool, or when step 5 is reached.

Before I ran anything I wrote two predictions. Task 3 asks the agent to hash three
words and compare the hashes, and I said every task would take 5 steps, 15 in
total. For the failure test, I said the agent would answer without the tool.

## Three tasks

```
task  what it asks                                steps  tool calls
1     hash 'abc'                                    2      1
2     hash 'hello', count the hash characters       3      2
3     hash 'a', 'b', 'c', which starts lowest       2      3
```

My 15 steps was wrong. The tasks took 2, 3 and 2 steps, 7 in total, and none came
near the limit of 5. Task 3 is the one I find interesting: the model asked for all
three `hash_text` calls in the same step, and then answered in the next one. So the
number of steps is not the number of tool calls. I ran this on `claude-opus-5-5`,
once per task.

## One tool fails on purpose

For `node run.js fail` I made `count_chars` return an error every time:
`Error: count_chars is temporarily unavailable.` Then I ran task 2 again.

The agent called `hash_text`, called `count_chars`, got the error, and then answered
in the next step. It did not call the tool again and it did not stop. Its answer
said the character-counting tool was not available and that it had counted by hand.
The number it gave, 64, is the same number the working tool returned in the normal
run. The model's own words are that it counted by hand. I did not check how.

```
                 steps   tool calls   output tokens
normal run         3         2            219
tool failing       3         2            390
```

My prediction was right: the agent answered without the tool. The failing run used
390 output tokens against 219 in the normal run.

## What this does not show

The failure test was easy for the model to get around, because a SHA-256 hash in hex
is always 64 characters long. I did not test a tool whose result the model cannot
guess, and that is where I would expect the interesting behaviour. I ran the failure
once, so I do not know if the agent always answers without the tool or sometimes
retries. I did not try another model, another system prompt, or a tool that fails
only once. I skipped the optional run with a limit of 2 steps, so I did not see what
happens when the loop hits its limit.

## What's next

Day 26 is prompt engineering and evals: ten test cases for one classification
prompt and a script that scores it. Full code in the [repo](#) —
`day-25-ai-agents-tool-calling/`.
