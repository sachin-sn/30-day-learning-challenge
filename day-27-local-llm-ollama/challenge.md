# Day 27 — Local LLMs with Ollama

Short format (about 90 minutes). Today you run the same 10 test cases from Day 26
on a small model on your own machine, and compare score and time with the Claude API.

## Predictions (5 min) — write them in `solution.md` BEFORE running anything

1. What score (a number out of 10) will the local model get on prompt v1?
2. Which is faster for the 10 cases, the local model or the API? Write the total time in seconds for each (two numbers).

## Part A: install and call it (about 40 min)

1. Install Ollama from ollama.com (the Mac app). Then in a terminal: `ollama pull llama3.2:3b`
   (about 2 GB download). You can use another small model, but write down its exact name.
2. Call the API once with curl (the server runs on port 11434):

   ```
   curl http://localhost:11434/api/chat -d '{"model":"llama3.2:3b","stream":false,"messages":[{"role":"user","content":"Say hello in 3 words."}]}'
   ```

3. Read `src/run.js`. It reads the cases and prompts from Day 26 (not copied). Then run:
   `node run.js ollama llama3.2:3b v1`

## Part B: compare (about 30 min)

1. `node run.js ollama llama3.2:3b v1 2` — look at the time of case 1 compared with the others (the model loads into memory on the first call).
2. `node run.js ollama llama3.2:3b v2 2`
3. API side for the time: `cd src && npm install`, key in the shell only, then `node run.js api v1 2`.

## Save in `solution.md`

- Score for each run (local v1, local v2, API v1), and the wrong cases with the model's answers.
- Total seconds per run, and the time of the first case compared with the rest.
- Anything the local model answered that is not exactly a label (the script marks it NOT A LABEL).

## Not today

Changing the model settings, bigger models, GPU tuning, fixing the answers with code
(for example stripping a full stop), editing the test cases.
