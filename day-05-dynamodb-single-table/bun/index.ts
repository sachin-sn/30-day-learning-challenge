import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

const TABLE = "app-table";

const client = new DynamoDBClient({
  endpoint: "http://localhost:8000",
  region: "us-east-1",
  credentials: { accessKeyId: "local", secretAccessKey: "local" }, // dummy — Local doesn't check these
});
const doc = DynamoDBDocumentClient.from(client);

type Status = "pending" | "done";

// --- entity helpers ---

async function createUser(userId: string, userName: string) {
  await doc.send(
    new PutCommand({
      TableName: TABLE,
      Item: { PK: `USER#${userId}`, SK: `USER#${userId}`, userName },
    }),
  );
}

async function createTodo(
  userId: string,
  todoId: string,
  title: string,
  status: Status,
) {
  await doc.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `USER#${userId}`,
        SK: `TODO#${todoId}`,
        title,
        status,
        // Only todo items carry a GSI1 key — user items don't need to
        // show up in the status index.
        GSI1PK: `STATUS#${status}`,
        GSI1SK: `TODO#${todoId}`,
      },
    }),
  );
}

async function getUser(userId: string) {
  const { Item } = await doc.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `USER#${userId}`, SK: `USER#${userId}` },
    }),
  );
  return Item;
}

async function getTodo(userId: string, todoId: string) {
  const { Item } = await doc.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `USER#${userId}`, SK: `TODO#${todoId}` },
    }),
  );
  return Item;
}

// Part 3 requirement: Query with a SK begins_with condition, not an exact match.
async function listTodosForUser(userId: string) {
  const { Items } = await doc.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ":prefix": "TODO#",
      },
    }),
  );
  return Items;
}

// Part 4: the access pattern the base table's PK (always user-scoped)
// cannot serve — every todo with a given status, across every user.
async function listTodosByStatus(status: Status) {
  const { Items } = await doc.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :status",
      ExpressionAttributeValues: { ":status": `STATUS#${status}` },
    }),
  );
  return Items;
}

// --- demo run ---

console.log("--- creating 2 users ---");
await createUser("u1", "sachin");
await createUser("u2", "amit");

console.log("--- creating 3 todos across both users ---");
await createTodo("u1", "t1", "learn dynamodb", "pending");
await createTodo("u1", "t2", "write blog post", "done");
await createTodo("u2", "t1", "review pr", "pending");

console.log("\n--- getUser(u1) ---");
console.log(await getUser("u1"));

console.log("\n--- listTodosForUser(u1)  [Query: PK + SK begins_with('TODO#')] ---");
console.log(await listTodosForUser("u1"));

console.log("\n--- getTodo(u1, t1)  [GetItem, exact PK+SK] ---");
console.log(await getTodo("u1", "t1"));

console.log(
  "\n--- listTodosByStatus('pending')  [Query on GSI1 — crosses u1 AND u2] ---",
);
console.log(await listTodosByStatus("pending"));
