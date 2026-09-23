import * as z from "zod";

const reqBody = z.object({
  title: z.string(),
  priority: z.literal(["low", "medium", "high"]).default("medium"),
});

const todoType = reqBody.extend({
  id: z.int(),
});

const envType = z.object({
  PORT: z.coerce.number().int().min(1).max(65535),
});

const todos: z.infer<typeof todoType>[] = [];

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
    },
  });

  console.log(`Bun server is running at ${server.url}`);
  const end = performance.now();
  console.log("server started - ", end);
  console.log(`total time: ${end - start} ms`);
} else {
  console.log("ERROR!!! properties missing in .env file", env.error.issues);
}
