import { createSchema, createYoga } from "graphql-yoga";
import { GraphQLError } from "graphql/error";
import * as z from "zod";

const todoPriority = z.literal(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM");

const reqBody = z.object({
  title: z.string().trim().min(1),
  priority: z.optional(todoPriority),
});

const todoType = reqBody.extend({
  id: z.int(),
});

const todos: z.infer<typeof todoType>[] = [];

const insertToTodo = (title: string, priority?: string) => {
  const newId = todos.length;
  const todo = todoType.parse({
    id: newId,
    title,
    priority: priority ?? "medium",
  });
  todos.push(todo);
  return todo;
};

const yoga = createYoga({
  schema: createSchema({
    typeDefs: /* GraphQL */ `
      enum Priority {
        LOW
        MEDIUM
        HIGH
      }

      type Todo {
        id: Int!
        title: String!
        priority: Priority!
      }

      type Query {
        todos: [Todo!]!
        todo(id: Int!): Todo
      }

      type Mutation {
        createTodo(title: String!, priority: Priority = MEDIUM): Todo!
      }
    `,
    resolvers: {
      Query: {
        todos: () => todos,
        todo: (_parent, args: { id: number }) =>
          todos.find((t) => t.id === args.id),
      },
      Mutation: {
        createTodo: async (_parent, args) => {
          const parsed = reqBody.safeParse({
            title: args.title,
            priority: args.priority,
          });
          if (parsed.success) {
            const todo = insertToTodo(parsed.data.title, parsed.data.priority);
            return todo;
          }
          throw new GraphQLError(
            parsed.error.issues[0]?.message ?? "Invalid input",
          );
        },
      },
    },
  }),
});

const start = performance.now();
console.log("server starting - ", start);
const server = Bun.serve({
  routes: {
    "/health": () => Response.json({ status: "ok" }),
    "/todos": {
      GET: () => Response.json({ todos: todos }),
      POST: async (req) => {
        const body = reqBody.parse(await req.json());
        const todo = insertToTodo(body.title, body.priority);
        return Response.json(todo);
      },
    },
    "/graphql": yoga,
  },
});

console.log(`Bun server is running at ${server.url}`);
const end = performance.now();
console.log("server started - ", end);
console.log(`total time: ${end - start} ms`);
