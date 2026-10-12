Day 21 of the 30-day challenge: LLM API basics. I streamed an answer from the Claude API in Node and timed it six times. The plan also had a comparison of temperature 0 and temperature 1, and that part did not work.

Before the code, I guessed "3 to 5 seconds" for the answer, and that two of three answers at temperature 0 would be the same. The API refused the temperature setting with "temperature is deprecated for this model" on every model I tried, so the second guess could not be tested. The first fits only if I meant the whole answer: the full response took 3.9 to 4.7 seconds, but the first text piece arrived after 1.1 to 1.9 seconds.

The surprise was in the response itself. Every one of the six had a thinking block before the text, although I never turned thinking on. So my time to first token is really the time to the first text piece, after the thinking. Output tokens were 345 to 368 for about 150 words, and my guess is that thinking tokens explain the gap. I did not measure that.

All six answers to the same prompt were different texts, 148 to 156 words each. Before any of that, the first error was not code at all: the Console account had no credit, and a claude.ai subscription does not include API credit.

Six runs on one model with one prompt is a small test. I do not know what the default temperature is, which model accepts the setting, or how much of the time is thinking. Full writeup on the blog: <link>

#30DayChallenge #ClaudeAPI #LLM #NodeJS #Streaming #SoftwareEngineering
