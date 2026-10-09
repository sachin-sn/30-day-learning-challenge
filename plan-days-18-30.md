# Plan for days 18 to 30 (short format)

Each day is 90 minutes: predictions (5 min), Part A build (about 40 min), Part B
measure or break (about 30 min), notes (about 15 min). If a part runs 15 minutes
over, stop and note it in `solution.md`. Blog and LinkedIn posts are optional now.
Use `_template/challenge.md` and `_template/solution.md`.

| Day | Topic | Part A (build) | Part B (measure or break) | Save |
| --- | ----- | -------------- | ------------------------- | ---- |
| 18 | OpenTelemetry | Add the OTel SDK to a small Node HTTP server. Print spans to the console. | Add one slow function call. Find it in the span output. | Span names with durations. Which span was slowest, against your prediction. |
| 19 | CI/CD: matrix and canary | A GitHub Actions workflow that runs tests on Node 20 and 22. | Make one version fail on purpose. Then write a script that sends 10% of 100 requests to "v2" and count them. | The run result for each version. The count of v2 requests. |
| 20 | OAuth2/OIDC and JWT | Sign and verify a JWT with `jose` (HS256, then RS256). | Try five bad tokens: expired, wrong audience, wrong key, changed payload, `alg: none`. | A table: token, accepted or rejected, error message. |
| 21 | LLM API basics | Call the API with a system prompt and stream the answer. | Same prompt 3 times at temperature 0 and 3 times at 1. Measure time to first token and total time. | Token counts, both times, and whether the answers differed. |
| 22 | RAG with embeddings | Embed 10 short texts. Search by cosine similarity in memory. | Ask 5 questions. Mark by hand if the right text is in the top 3. | Top-3 hit count out of 5, and one miss with the reason you think. |
| 23 | Vector database | Run pgvector or Chroma in Docker. Store the Day 22 vectors. | Run the same 5 questions. Compare results and time with Day 22. Add an index and run again. | Same or different results, times before and after the index. |
| 24 | MCP server | Build an MCP server with 2 tools (reuse `/hash` and `/info` logic). | Connect with the MCP inspector or Claude Desktop. Call each tool once, and one call with bad input. | The request and response of each call. |
| 25 | AI agents and tool calling | A loop with 2 tools and a limit of 5 steps. | Give it 3 tasks. Log each tool call. Make one tool fail on purpose. | Steps per task. What the agent did after the failure. |
| 26 | Prompt engineering and evals | 10 test cases for one classification prompt. A script that scores it. | Change the prompt once. Run again twice. Compare the scores. | Score for each prompt version, and the difference between the two runs of the same prompt. |
| 27 | Local LLMs with Ollama | Install Ollama, pull one small model, call its API. | Run the Day 26 test cases on it. Compare score and time. | Score and time, local against API. |
| 28 | React Server Components and signals | A Next.js page with one server component and one client counter. | Build the same counter with signals. Count renders when the value changes. | Render counts for both. |
| 29 | WebAssembly: Rust to JS | Compile one Rust function to WASM. Call it from Node. | Time it against the JS version for 3 input sizes. | Times for each size, and where WASM was slower. |
| 30 | Capstone | Pick two earlier pieces (for example the MCP server and OpenTelemetry) and connect them. | Show one request travelling through both. | One trace or log of the full path. |

Rules that stay: you write the predictions, nothing in the notes is invented,
anything not measured is marked as not measured.
