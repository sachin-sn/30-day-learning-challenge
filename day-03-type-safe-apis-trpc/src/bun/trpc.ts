import { initTRPC } from "@trpc/server";
import * as z from "zod";

export const reqBody = z.object({
  title: z.string(),
  priority: z.literal(["low", "medium", "high"]).default("medium"),
});

export const todoType = reqBody.extend({
  id: z.int(),
});

export const envType = z.object({
  PORT: z.coerce.number().int().min(1).max(65535),
});

// Shared in-memory store — both the tRPC router below and the plain REST
// routes in index.ts read/write this same array, so `todos.list` and
// `GET /todos` always agree.
export const todos: z.infer<typeof todoType>[] = [];

export const t = initTRPC.create();
const publicProcedure = t.procedure;

export const appRouter = t.router({
  health: {
    check: publicProcedure
      .output(z.object({ status: z.string() }))
      .query(() => {
        return { status: "ok" };
      }),
  },
  todos: {
    create: publicProcedure
      .input(reqBody)
      .output(todoType)
      .mutation((opts) => {
        const { title, priority } = opts.input;
        const id = todos.length;
        const todo = { id, title, priority };
        todos.push(todo);
        return todo;
      }),
    list: publicProcedure
      .output(z.object({ todos: z.array(todoType) }))
      .query(() => {
        return { todos };
      }),
  },
});

export type AppRouter = typeof appRouter;
