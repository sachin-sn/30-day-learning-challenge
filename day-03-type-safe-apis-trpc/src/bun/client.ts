import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "./trpc";

// Match whatever PORT your .env has the server running on.
const PORT = process.env.PORT ?? "3000";

const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `http://localhost:${PORT}/trpc`,
    }),
  ],
});

async function main() {
  const health = await client.health.check.query();
  console.log("health.check ->", health);

  const before = await client.todos.list.query();
  console.log("todos.list (before) ->", before);

  const created = await client.todos.create.mutate({ title: "learn trpc" });
  console.log("todos.create ->", created);

  const after = await client.todos.list.query();
  console.log("todos.list (after) ->", after);

  // --- The actual point of today ---
  // Uncomment this and look at your editor (or run `bun run tsc --noEmit`,
  // if you add a tsc script) *before* running the file. This should be a
  // red squiggle / compile error, not something you discover by running
  // it and getting a confusing 400 back.
  //
  // await client.todos.create.mutate({ ttitle: "typo" });
  //
  // Paste the exact TypeScript error you get into solution.md — that's
  // the concrete "compile-time, not runtime" proof the challenge asks for.
}

main();
