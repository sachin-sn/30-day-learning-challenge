Day 25 of the 30-day challenge: the loop inside an AI agent. I read a 50-line loop with two tools (hash a text, count its characters) and a limit of 5 steps, ran it on three tasks, and then made one tool fail on purpose to see what the model would do.

I made two guesses first. Every task would use all 5 steps, 15 in total, and after a tool failure the agent would answer without the tool. The first was wrong. The tasks took 2, 3 and 2 steps, 7 in total. In the task that asked for three hashes, the model requested all three tool calls in the same step and answered in the next, so steps and tool calls are not the same number.

The second guess was right. When count_chars returned an error, the agent did not call it again and did not give up. It said the tool was not available and answered anyway, with the same number the working tool had returned in the normal run. The failed run used 390 output tokens, against 219 for the normal run.

That test was easy for the model to get around, because a SHA-256 hash in hex always has 64 characters. I did not try a tool whose result the model cannot guess, which is where I would expect the real behaviour. I ran the failure once on one model, so I do not know if it always answers without the tool, and I skipped the run with a lower step limit. The starter code was written by Claude, and I read it and ran it. Full writeup on the blog: <link>

#30DayChallenge #AIAgents #ToolCalling #ClaudeAPI #NodeJS #SoftwareEngineering
