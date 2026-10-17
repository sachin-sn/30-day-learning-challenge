Day 26 of the 30-day challenge: prompt evals. I took a small script with ten customer support messages, each with an expected label (billing, bug, feature_request or other), and scored a classification prompt by exact match. Then I changed the prompt, and ran it all again on a second model.

My guesses first. For the score of the first prompt I did not give a number, which was not a real prediction. For two runs of the same prompt I said the scores would differ by 2 points or more. That was wrong: the difference was 0.

Every run scored 10 out of 10. The short prompt, the version with a definition for each label, Haiku and Opus, 11 runs in total, and no answer changed between runs. So the result is not that the prompt is good. It is that my ten cases were too easy to tell two prompts or two models apart. The starter code and the labels were written by Claude, and I read and ran them.

What I did not test: messages that fit two labels, longer or messier messages, other models or settings, and the time and cost per run. With ten cases and a few runs I can say the answers did not vary here, not that they never vary.

Next is Ollama on my own machine, running the same ten cases to compare score and time. Full writeup on the blog: <link>

#30DayChallenge #PromptEngineering #LLMEvals #ClaudeAPI #NodeJS #SoftwareEngineering
