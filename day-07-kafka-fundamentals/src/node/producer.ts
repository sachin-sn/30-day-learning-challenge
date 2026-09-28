import * as z from "zod";
import { Kafka } from "kafkajs";

export const todoType = z.object({
  id: z.number(),
  title: z.string().trim().min(1),
  priority: z.optional(z.literal(["low", "medium", "high"]).default("medium")),
});

export const TOPIC = "todos";

const kafka = new Kafka({
  clientId: "todo-app",
  brokers: ["localhost:19092"],
});

export const prod = async (todo: any, topic: string = TOPIC) => {
  const producer = kafka.producer();

  await producer.connect();
  const message = todoType.safeParse(todo);
  if (message.success) {
    await producer.send({
      topic: topic,
      messages: [{ value: JSON.stringify(message.data) }],
    });
  }
  await producer.disconnect();
};
await prod({ id: 1, title: "Eat" }, TOPIC);
await prod({ id: 2, title: "Sleep", priority: "high" });
await prod({ id: 3, title: "repeat", priority: "low" });
await prod({ id: 1, title: "Do-nothing", priority: "low" }, "DEMO");
