import * as z from "zod";
import { Kafka } from "kafkajs";

export const todoType = z.object({
  id: z.number(),
  title: z.string().trim().min(1),
  priority: z.optional(z.literal(["low", "medium", "high"]).default("medium")),
});

export const messageType = z.object({
  key: z.string(),
  value: z.any(),
  partition: z.optional(z.number()),
});

export const TOPIC = "todos-v2";

const kafka = new Kafka({
  clientId: "todo-app",
  brokers: ["localhost:19092"],
});

export const prod = async (
  messages: z.infer<typeof messageType>[],
  topic: string = TOPIC,
) => {
  const producer = kafka.producer();

  await producer.connect();
  // Skipping validation for time being
  // const message = todoType.safeParse(messages);
  // if (message.success) {
  //   await producer.send({
  //     topic: topic,
  //     messages: messages,
  //   });
  // }
  await producer.send({
    topic,
    messages,
  });
  await producer.disconnect();
};

const keys = ["Bane", "Jocker", "Penguin", "Riddler", "Two-Face"];
const values = [
  "Hi",
  "Mayday Mayday",
  "Hello",
  "Need backup",
  "Batman's here",
  "Need back up now",
  "Let's regroup",
  "Over and out!",
];

const messages: z.infer<typeof messageType>[] = [];

const ui = Math.floor(Math.random() * keys.length); // getting fixed key
for (let i = 0; i < 8; i++) {
  //const ui = Math.floor(Math.random() * keys.length); trying for fixed keys
  //const mi = Math.floor(Math.random() * values.length);
  messages.push({ key: keys[ui], value: values[i] });
}

prod(messages, TOPIC);
