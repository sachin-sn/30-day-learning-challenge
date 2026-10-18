Day 27 of the 30-day challenge: a local LLM with Ollama. I installed Ollama, pulled a 3B model (llama3.2:3b, about 2 GB), and ran the same ten test cases from Day 26 on it, then compared score and time with the Claude API.

My guesses first: the local model would score 10 out of 10, and it would be faster, at about 100 ms per case. The score was 9 in the first run and 10, 10 in the next command, so it was right in two of the three. The speed was close: most calls took 65 to 115 ms, and ten cases took about 1 second. On the API the same ten cases took 8.5 to 9.1 seconds.

The surprise was the API. Haiku scored 9 and then 10, and one case changed its answer between the two runs. On Day 26 the same model scored 10 out of 10 in all five runs of the same prompt. So the model can vary on these cases, and my "no variation" result was only about those runs. The prompt with the definitions did worse on the local model, 9 and 9, but that is two runs, so I would not say more than that.

The comparison is not fair. The local model runs on my machine with no network, the API goes over the internet, and the models differ a lot in size. I had ten cases and one or two runs each. I did not measure memory use, cost, other local models, or the temperature. The script was written by Claude, and I read it and ran it. Full writeup on the blog: <link>

#30DayChallenge #Ollama #LocalLLM #LLMEvals #NodeJS #SoftwareEngineering
