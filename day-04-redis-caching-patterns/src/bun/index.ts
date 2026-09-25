import { redis } from "bun";

type reqBody = {
  title: string;
};

type todoType = {
  id: number;
  title: string;
};

// Todos key for redis
const TODOS = "todos";
const TTL_SECONDS = 30;
const SIMULATED_DB_DELAY_MS = 200;

const todos: todoType[] = [];
await redis.connect();

// Stand-in for a real database round trip — nothing here is instant in a
// real backend, so the cache has something real to actually speed up.
async function getTodosFromSource(): Promise<todoType[]> {
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_DB_DELAY_MS));
  return todos;
}

async function cacheTodos(updatedTodos: todoType[]) {
  await redis.set(TODOS, JSON.stringify(updatedTodos));
  await redis.expire(TODOS, TTL_SECONDS); // every cache write gets a TTL
}

const start = performance.now();
console.log("server starting - ", start);
const server = Bun.serve({
  routes: {
    "/health": () => Response.json({ status: "ok" }),
    "/todos": {
      GET: async () => {
        const readStart = performance.now();
        const cached = await redis.get(TODOS);

        if (cached) {
          const ms = performance.now() - readStart;
          console.log(`cache HIT - ${ms.toFixed(2)}ms`);
          return Response.json({ todos: JSON.parse(cached), source: "hit", ms });
        }

        console.log("cache MISS - falling through to source");
        const freshTodos = await getTodosFromSource();
        await cacheTodos(freshTodos); // awaited: a failed write shouldn't be a silent unhandled rejection
        const ms = performance.now() - readStart;
        console.log(`cache MISS - ${ms.toFixed(2)}ms (includes simulated source + cache write)`);
        return Response.json({ todos: freshTodos, source: "miss", ms });
      },
      POST: async (req) => {
        const body = (await req.json()) as reqBody;
        const todo = {
          id: todos.length,
          title: body.title,
        };
        todos.push(todo);
        await redis.del(TODOS); // invalidating cache as there is some changes to the data
        return Response.json(todo);
      },
    },
  },
});

console.log(`Bun server is running at ${server.url}`);
const end = performance.now();
console.log("server started - ", end);
console.log(`total time: ${end - start} ms`);
