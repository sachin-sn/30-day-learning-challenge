import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, envType, reqBody, todos } from "./trpc";

const start = performance.now();
console.log("server starting - ", start);
const env = envType.safeParse(process.env);
if (env.success) {
  const server = Bun.serve({
    port: env.data.PORT,
    routes: {
      "/health": () => Response.json({ status: "ok" }),
      "/todos": {
        GET: () => Response.json({ todos }),
        POST: async (req) => {
          const body = reqBody.safeParse(await req.json());
          if (!body.success) {
            return Response.json({ errors: body.error.issues }, 400);
          }

          const { title, priority } = body.data;
          const id = todos.length;
          const todo = { id, title, priority };
          todos.push(todo);
          return Response.json(todo);
        },
      },
      // tRPC router mounted alongside the plain REST routes above — both
      // read/write the same `todos` array from trpc.ts, so either one
      // sees whatever the other one did.
      "/trpc/*": (req) =>
        fetchRequestHandler({
          endpoint: "/trpc",
          req,
          router: appRouter,
          createContext: () => ({}),
        }),
    },
  });

  console.log(`Bun server is running at ${server.url}`);
  const end = performance.now();
  console.log("server started - ", end);
  console.log(`total time: ${end - start} ms`);
} else {
  console.log("ERROR!!! properties missing in PORT config", env.error.issues);
}
