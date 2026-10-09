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

> From day 18 the challenges use a short format (about 90 minutes: build,
> measure, notes; blog and LinkedIn optional). See
> [plan-days-18-30.md](./plan-days-18-30.md). Days 01 to 17 keep the longer format.

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

| Day | Topic                                          | Stack                               | Status    | Blog | LinkedIn |
| --- | ---------------------------------------------- | ----------------------------------- | --------- | ---- | -------- |
| 01  | [Bun Runtime vs Node.js](./day-01-bun-vs-node) | Bun, Node.js                        | Completed | —    | —        |
| 02  | [Runtime Validation with Zod](./day-02-runtime-validation-zod) | TypeScript, Zod | Completed | —    | —        |
| 03  | [Type-safe APIs with tRPC](./day-03-type-safe-apis-trpc) | tRPC, TypeScript | Completed | —    | —        |
| 04  | [Redis Caching Patterns](./day-04-redis-caching-patterns) | Redis, Bun/Node.js | Completed | —    | —        |
| 05  | [DynamoDB Single-Table Design](./day-05-dynamodb-single-table) | AWS DynamoDB | Completed | —    | —        |
| 06  | [GraphQL Basics](./day-06-graphql-basics) | GraphQL Yoga, TypeScript | Completed | —    | —        |
| 07  | [Kafka Fundamentals](./day-07-kafka-fundamentals) | Redpanda, Docker | Completed | —    | —        |
| 08  | [Kafka Consumer Groups & Partitioning](./day-08-kafka-consumer-groups-partitioning) | Kafka/Redpanda | Completed | —    | —        |
| 09  | [Event-Driven Architecture (SNS/SQS vs Pub/Sub)](./day-09-event-driven-sns-sqs-pubsub) | AWS SNS/SQS, GCP Pub/Sub | Completed | —    | —        |
| 10  | [Real-time with WebSockets](./day-10-realtime-websockets) | WebSockets, Node.js | Completed | —    | —        |
| 11  | [gRPC Service-to-Service Communication](./day-11-grpc-service-to-service) | gRPC, Protocol Buffers | Completed | —    | —        |
| 12  | [Rate Limiting Algorithms from Scratch](./day-12-rate-limiting-algorithms) | Node.js, Redis | Completed | —    | —        |
| 13  | [Distributed Locks with Redis Redlock](./day-13-distributed-locks-redlock) | Redis | Completed | —    | —        |
| 14  | [Infrastructure as Code (Terraform/Pulumi)](./day-14-infrastructure-as-code-terraform) | Terraform or Pulumi | Completed | —    | —        |
| 15  | [Lambda vs Cloud Functions vs Workers](./day-15-lambda-vs-cloud-functions-vs-workers) | AWS, GCP, Cloudflare | Completed | —    | —        |
| 16  | [Deploying to the Edge](./day-16-deploying-to-the-edge) | Cloudflare Workers | Completed | —    | —        |
| 17  | [Docker Multi-stage + Minimal Kubernetes](./day-17-docker-multistage-kubernetes) | Docker, Kubernetes (kind) | Partial | —    | —        |
| 18  | [Observability with OpenTelemetry](./day-18-observability-opentelemetry) | OpenTelemetry, Node.js | Completed | —    | —        |
| 19  | CI/CD: Matrix Builds & Canary Deploys          | GitHub Actions                      | Planned   | —    | —        |
| 20  | OAuth2/OIDC & JWT Deep Dive                    | Node.js, OAuth2                     | Planned   | —    | —        |
| 21  | LLM API Fundamentals                           | Claude/OpenAI API                   | Planned   | —    | —        |
| 22  | RAG Fundamentals with Embeddings               | Embeddings, Node.js                 | Planned   | —    | —        |
| 23  | Vector Database Deep Dive                      | pgvector or Chroma                  | Planned   | —    | —        |
| 24  | Building an MCP Server                         | Model Context Protocol SDK          | Planned   | —    | —        |
| 25  | AI Agents & Tool-Calling Orchestration         | LangGraph or hand-rolled agent loop | Planned   | —    | —        |
| 26  | Prompt Engineering & Evals                     | LLM APIs                            | Planned   | —    | —        |
| 27  | Local LLMs with Ollama                         | Ollama                              | Planned   | —    | —        |
| 28  | React Server Components & Signals              | Next.js, Preact/Solid               | Planned   | —    | —        |
| 29  | WebAssembly: Rust → JS                         | Rust, WASM                          | Planned   | —    | —        |
| 30  | Capstone: Integrated Mini-Project              | Combines earlier days               | Planned   | —    | —        |

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
