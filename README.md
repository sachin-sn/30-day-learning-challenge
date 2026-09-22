# 30 Day Learning Challenge

One new piece of tech, learned and implemented in public, every day for 30
days — foundations first, distributed systems and cloud in the middle, the
AI stack and a capstone at the end.

Each day is a self-contained folder: a challenge to attempt, a working
solution, and (for the original run) a companion blog post and LinkedIn
write-up. Fork this repo and use it to run your own version of the
challenge — swap any day for a different technology if it fits your goals
better.

## How this works

1. Each day lives in its own folder: `day-NN-<topic-slug>/`
2. `challenge.md` — the problem statement, objectives, and constraints for
   that day
3. `solution.md` — the write-up of the approach once it's solved, plus links
   to the blog post and LinkedIn post
4. `src/` — the actual working code for that day
5. `_template/` — copy `challenge.md` and `solution.md` from here when adding
   a new day (either continuing this list or substituting your own)

## Rules of the challenge

- One folder per day, numbered sequentially
- Basic → advanced: early days assume less prior exposure to that day's tech,
  later days build on earlier ones where it makes sense
- Every day gets a short write-up (`solution.md`) — the goal is to explain
  the concept well enough that someone else could learn from it, not just to
  get code working
- Publish as you go — a blog post per day and a LinkedIn post keep it
  public and keep the pressure on to actually finish each one

## The 30 days

| Day | Topic | Stack | Status | Blog | LinkedIn |
|-----|-------|-------|--------|------|----------|
| 01 | [Bun Runtime vs Node.js](./day-01-bun-vs-node) | Bun, Node.js | In progress | — | — |
| 02 | Runtime Validation with Zod | TypeScript, Zod | Planned | — | — |
| 03 | Type-safe APIs with tRPC | tRPC, TypeScript | Planned | — | — |
| 04 | Redis Caching Patterns | Redis, Node.js | Planned | — | — |
| 05 | DynamoDB Single-Table Design | AWS DynamoDB | Planned | — | — |
| 06 | GraphQL Basics | GraphQL Yoga/Apollo | Planned | — | — |
| 07 | Kafka Fundamentals | Kafka/Redpanda, Docker | Planned | — | — |
| 08 | Kafka Consumer Groups & Partitioning | Kafka/Redpanda | Planned | — | — |
| 09 | Event-Driven Architecture (SNS/SQS vs Pub/Sub) | AWS SNS/SQS, GCP Pub/Sub | Planned | — | — |
| 10 | Real-time with WebSockets | WebSockets, Node.js | Planned | — | — |
| 11 | gRPC Service-to-Service Communication | gRPC, Protocol Buffers | Planned | — | — |
| 12 | Rate Limiting Algorithms from Scratch | Node.js, Redis | Planned | — | — |
| 13 | Distributed Locks with Redis Redlock | Redis | Planned | — | — |
| 14 | Infrastructure as Code (Terraform/Pulumi) | Terraform or Pulumi | Planned | — | — |
| 15 | Lambda vs Cloud Functions vs Workers | AWS, GCP, Cloudflare | Planned | — | — |
| 16 | Deploying to the Edge | Cloudflare Workers / Vercel Edge | Planned | — | — |
| 17 | Docker Multi-stage + Minimal Kubernetes | Docker, Kubernetes (kind) | Planned | — | — |
| 18 | Observability with OpenTelemetry | OpenTelemetry, Node.js | Planned | — | — |
| 19 | CI/CD: Matrix Builds & Canary Deploys | GitHub Actions | Planned | — | — |
| 20 | OAuth2/OIDC & JWT Deep Dive | Node.js, OAuth2 | Planned | — | — |
| 21 | LLM API Fundamentals | Claude/OpenAI API | Planned | — | — |
| 22 | RAG Fundamentals with Embeddings | Embeddings, Node.js | Planned | — | — |
| 23 | Vector Database Deep Dive | pgvector or Chroma | Planned | — | — |
| 24 | Building an MCP Server | Model Context Protocol SDK | Planned | — | — |
| 25 | AI Agents & Tool-Calling Orchestration | LangGraph or hand-rolled agent loop | Planned | — | — |
| 26 | Prompt Engineering & Evals | LLM APIs | Planned | — | — |
| 27 | Local LLMs with Ollama | Ollama | Planned | — | — |
| 28 | React Server Components & Signals | Next.js, Preact/Solid | Planned | — | — |
| 29 | WebAssembly: Rust → JS | Rust, WASM | Planned | — | — |
| 30 | Capstone: Integrated Mini-Project | Combines earlier days | Planned | — | — |

Status and links are updated as each day is completed.

## Why these 30

The arc moves from modern runtime/API tooling, through messaging and
distributed-systems concepts, into cloud/infra tradeoffs, then the current AI
stack, finishing with a capstone that ties a few pieces together. It's biased
toward things that show up in both real production systems and technical
interviews — rate limiting, NoSQL modeling, caching, distributed locks,
cloud service tradeoffs — while also covering what's newer and still
solidifying: Kafka-style streaming, vector databases, MCP servers, AI agents,
edge runtimes, and WebAssembly.

## Using this for your own challenge

This repo is meant to be forked:

1. Copy `_template/challenge.md` and `_template/solution.md` into a new
   `day-NN-<your-topic>/` folder
2. Swap in whatever technology fits your own goals — the day list above is a
   starting point, not a requirement
3. Keep the same structure (`challenge.md`, `solution.md`, `src/`) so the
   pattern stays consistent across days

## License

MIT — see [LICENSE](./LICENSE). Use, fork, and adapt freely.
