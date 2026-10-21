Day 30, the last day of my 30-day learning challenge. For the capstone I connected three earlier days: the agent loop from Day 25, the local embeddings from Day 22 and the pgvector table from Day 23. The agent has one tool that searches my own notes, and I timed one request through all of it.

My guesses first: the agent would need 3 model calls, and the pgvector query would be the slowest part. Both were wrong. It needed 2 model calls, and the two model calls took about 5 seconds each in the second run, while the embedding and the database query took 12 ms each. The model also wrote a different search text in each run, so the second run was not the same request as the first.

I also stopped the database to see what happens. The agent did not crash. The error showed first on the pgvector query, the tool passed it to the model as text, the model tried a second search, failed again, and then answered with a clear "I couldn't reach your notes". An off-topic question used 1 model call and no search at all.

What I did not test: other questions, other models, a bigger table, streaming, a failing embedding step, or why the model call times varied so much. It was one machine and ten short notes. The starter code was written by Claude, and I ran it and measured it. Full writeup on the blog: <link>

Thank you to everyone who followed these 30 days and read the posts. And thank you to Claude, which helped me plan the days, wrote the starter code and helped me check my results. I learned a lot, including from being wrong about my own predictions.

#30DayChallenge #AIAgents #RAG #pgvector #NodeJS #SoftwareEngineering
