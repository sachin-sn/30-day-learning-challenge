import { todoType, TOPIC } from "./producer";
import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "todo-app",
  brokers: ["localhost:19092"],
});

export const cons = async () => {
  const consumer = kafka.consumer({ groupId: "todo-consumer" });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }: any) => {
      console.log({
        topic,
        partition,
        value: JSON.parse(message.value.toString()),
      });
    },
  });
};
await cons();
