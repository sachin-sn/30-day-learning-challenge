---
title: "Day 27 — The Same Ten Cases on a Local 3B Model: 1 Second Against 9"
date: "2026-10-18"
excerpt: "I installed Ollama, pulled a 3B model, and ran the Day 26 test cases on it. It took about 1 second for the ten cases, against 9 seconds on the Claude API, and the scores were close."
tags: ["30-day-challenge", "day-27", "ollama", "local-llm", "evals", "nodejs"]
draft: true
---

Day 26 scored a classification prompt on ten test cases. Day 27 runs the same
cases on a model on my own machine, to compare score and time. It is the short
90-minute format again.

## The setup

I installed Ollama, the Mac app, and pulled `llama3.2:3b`, a download of about 2 GB.
Ollama runs a server on port 11434, so the first test was a `curl` call to
`/api/chat` with "Say hello in 3 words." The answer was "Hello there friend." The
call took 3.24 seconds in total, and 2.89 of them were `load_duration`: the model
loading into memory on the first call.

The script `run.js` was written by Claude, and I read it and ran it. It reads the
cases and the two prompts from my Day 26 folder, without copying them, sends each
message to either Ollama or the Claude API, and times every call. The API model was
`claude-haiku-5-5`, the same as the main Day 26 runs. Settings were the defaults,
except that I limited the local answer to 100 tokens.

Two predictions came first. For the score of the local model on prompt v1 I said 10.
For the speed I said that the local model would be faster, at about 100 ms per case.

## The results

```
backend               prompt   command   scores    total seconds
ollama llama3.2:3b    v1       1 run     9         1.5
ollama llama3.2:3b    v1       2 runs    10, 10    1.0, 0.9
ollama llama3.2:3b    v2       2 runs    9, 9      1.2, 0.9
api claude-haiku-5-5  v1       2 runs    9, 10     9.1, 8.5
```

My score of 10 was right in two of the three local v1 runs. In the first run case 1
("charged twice") came back as "other". In the next command it came back as
"billing". The prompt with the definitions, v2, did worse locally: 9 and 9, with
case 5 ("invoice shows the wrong company name") as "other" both times. That is only
two runs, so I would not say v2 is worse.

The speed guess was close. Most local calls took 65 to 115 ms. Ten cases took about
1 second locally, against 8.5 to 9.1 seconds on the API, where one call took 730 to
1170 ms. Every local answer was exactly a label, so nothing was marked "not a label".

## The API also varied

The surprise was on the API side. Haiku scored 9 and then 10 on v1, and case 9
("can't download invoice, page shows an error") changed from "billing" to "bug". On
Day 26 the same model scored 10 out of 10 in all five runs of v1. So the model can
vary on these cases, and my Day 26 result of 0 points of difference was about those
runs only.

## What I did not measure

The speed comparison is not fair. The local model runs on my machine with no network,
the API call goes over the internet, and the models are very different in size, so
the times say nothing about the models alone. I had ten cases and one or two runs per
command, so I cannot say what the usual local score is. I did not run v2 on the API
today. Memory and CPU use of the local model, the cost of the API calls, other local
models, and Ollama's temperature were not measured or checked.

## What's next

Day 28 is React Server Components and signals, with render counts in Next.js. Full
code in the [repo](#) — `day-27-local-llm-ollama/`.
