import { TOPIC } from "./producer";
import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "todo-app-v2",
  brokers: ["localhost:19092"],
});

export const cons = async () => {
  const groupId = process.env.GROUP_ID || "todo-consumer-v2";
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log({
        Topic: topic,
        Partition: partition,
        Key: message.key.toString(),
        Value: message.value.toString(),
        Headers: message.headers,
      });
    },
  });
};
await cons();
