type reqBody = {
  title: string;
};

type todoType = {
  id: number;
  title: string;
};

const todos: todoType[] = [];

const start = performance.now();
console.log("server starting - ", start);
const server = Bun.serve({
  routes: {
    "/health": () => Response.json({ status: "ok" }),
    "/todos": {
      GET: () => Response.json({ todos: todos }),
      POST: async (req) => {
        const body = (await req.json()) as reqBody;
        const title = body.title;
        let newId = todos[todos.length - 1]?.id ?? 0;
        newId++;
        todos.push({
          id: newId,
          title,
        });
        return Response.json({ id: newId, title });
      },
    },
  },
});

console.log(`Bun server is running at ${server.url}`);
const end = performance.now();
console.log("server started - ", end);
console.log(`total time: ${end - start} ms`);
