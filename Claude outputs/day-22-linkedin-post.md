Day 22 of the 30-day challenge: the retrieval step of RAG, on its own. I embedded ten short texts with a small model that runs on my Mac (no API key, no cost), then asked five questions and checked the top 3 results myself. No LLM, no vector database yet.

I made two guesses first. One embedding would have 4 numbers, and the right text would be in the top 3 for 3 of 5 questions. Both were wrong. The vector has 384 numbers, and the right text came first for all 5 questions, even though the questions (written by Claude, with the texts) avoid the key words of the text they should find. A question about workers sitting idle when you add more of them found the Kafka text about partitions and consumers.

The result I will remember is the close call. For one question (about a server limiting requests per second) the right text scored 0.335 and the wrong second place scored 0.317. In the other four questions the gap was 0.185 or more. I do not know why that one was close, and I have not tested it.

Embedding all ten texts took about 50 ms. Loading the model took 3.4 seconds on the first run and under 0.3 seconds after that.

Ten texts and five questions from one author make a small test, so "5 of 5" says little about real documents. I did not try other models, long documents or a larger set. Tomorrow I put the same vectors in a vector database and run the same questions. Full writeup on the blog: <link>

#30DayChallenge #RAG #Embeddings #NodeJS #AI #SoftwareEngineering
