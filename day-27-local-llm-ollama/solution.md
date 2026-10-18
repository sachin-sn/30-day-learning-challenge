# Day 27 — Local LLMs with Ollama

## Predictions (written before running anything)

1. Score of the local model on prompt v1 (out of 10): 10
2. Which is faster for the 10 cases, local or API, and the total seconds for each: "local should be faster, 100ms for each" (no total seconds given)

## Output

Local model: `llama3.2:3b` through Ollama (about 2 GB download), default settings except `num_predict: 100`. API model: `claude-haiku-5-5`, default settings. Cases and prompts are the ones from Day 26. Time per call is measured in `run.js` around each request, one case after another.

### Call with curl

`"Say hello in 3 words."` gave `"Hello there friend."`. total_duration 3.24 s, of which load_duration 2.89 s (the model loading into memory on the first call), prompt_eval 0.26 s, eval 0.07 s for 5 tokens.

### Scores and times

| backend              | prompt | command | scores | total seconds | wrong cases                                  |
| -------------------- | ------ | ------- | ------ | ------------- | -------------------------------------------- |
| ollama llama3.2:3b   | v1     | 1 run   | 9      | 1.5           | #1 got "other" (expected billing)            |
| ollama llama3.2:3b   | v1     | 2 runs  | 10, 10 | 1.0, 0.9      | none                                         |
| ollama llama3.2:3b   | v2     | 2 runs  | 9, 9   | 1.2, 0.9      | #5 got "other" (expected billing), both runs |
| api claude-haiku-5-5 | v1     | 2 runs  | 9, 10  | 9.1, 8.5      | run 1: #9 got "billing" (expected bug)       |

- Time per case, local: about 65 to 115 ms in most cases. The slowest were #1 in the first run (469 ms), #4 (323 ms) and #1 in the v2 run (374 ms). Every answer was exactly a label, none was marked NOT A LABEL.
- Time per case, API: about 730 to 1170 ms.
- Local v1 first command: score 9 (case 1 wrong). The next command with the same prompt: 10 and 10, so case 1 changed between those two commands. Inside each 2-run command no case changed.
- API v1: case 9 changed between run 1 (billing, wrong) and run 2 (bug, right). On Day 26 this model scored 10/10 in all 5 runs of v1, so this is the first time I saw it below 10, in 7 runs of v1 in total.
- Local v2 scored lower than local v1 in these commands (9, 9 against 10, 10). Only 2 runs each, and v2 was not run on the API today.
- The model load of the local model happened in the curl call, before `run.js` ran. `run.js` prints the load time only when it is above 100 ms, and it printed none.

## What I learned (3 sentences)

- Local LLMs are faster when compared to APIs
- Running same tests, resulted in different output, when running on different days for the same questions.

## Not measured / still open

- Not the same conditions: the local model runs on this machine with no network, the API call goes over the internet, and the models differ a lot in size. The times say nothing about the models alone.
- Only 10 cases, 1 to 2 runs per command. Local v1 scored 9, then 10 and 10, so I cannot say what its usual score is.
- API v2 was not run today. Opus was not run today.
- Memory and CPU use of the local model, the cost of the API calls, and other local models: not measured.
- Ollama's default temperature was not changed, and I did not check what it is.

## Link

TODO: https://docs.ollama.com/
