Day 23 of the 30-day challenge: a vector database. I moved the ten embeddings from Day 22 into pgvector (Postgres with a vector column, running in Docker) and asked the same five questions through SQL. All five gave the same three results in the same order, with the same scores to three decimals. That was my prediction, and it was right.

Then I added 20,000 random vectors and timed one search before and after an HNSW index. My guesses were 200 ms without an index and 20 ms with one. Both were far too high. Without the index the median was 7.1 ms, with a parallel scan over all rows. With the index it was 1.6 ms, which is 4.4 times faster, not the 10 times I had guessed. The index took 4.8 seconds to build.

What I will remember is the query plan. The plan is where you can see that the database switched from reading the whole table to using the index. Timing alone would not have shown that.

Smaller things: I pasted the docker run command without the image name, and then Docker was not running at all.

Caveats are important here. My query had a filter on the id, and I did not check whether it used the index, so "same results after the index" may not say anything about the index. HNSW is approximate and I did not measure how often it misses. The 20,000 vectors were random numbers, and it was one question on one machine. Full writeup on the blog: <link>

#30DayChallenge #pgvector #PostgreSQL #VectorDatabase #RAG #SoftwareEngineering
