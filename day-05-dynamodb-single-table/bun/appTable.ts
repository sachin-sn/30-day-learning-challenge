import { DynamoDBClient, CreateTableCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({
  endpoint: "http://localhost:8000",
  region: "us-east-1",
  credentials: { accessKeyId: "local", secretAccessKey: "local" }, // dummy — Local doesn't check these
});

// Single-table design: one table for both entity types (user, todo),
// told apart by the SK prefix.
//   User item: PK = USER#<userId>,  SK = USER#<userId>
//   Todo item: PK = USER#<userId>,  SK = TODO#<todoId>
//              GSI1PK = STATUS#<status>, GSI1SK = TODO#<todoId>  (todos only)
const response = await client.send(
  new CreateTableCommand({
    TableName: "app-table",

    // AttributeDefinitions lists ONLY attributes used by a key schema
    // (base table or a GSI) — everything else (userName, title, status)
    // is a regular item attribute and doesn't belong here.
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
      { AttributeName: "GSI1PK", AttributeType: "S" },
      { AttributeName: "GSI1SK", AttributeType: "S" },
    ],

    // Base table: composite key so one partition (one user) can hold
    // both their profile item and all of their todo items.
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],

    // GSI1: serves "list all todos with status X across every user" —
    // an access pattern the base table's user-scoped PK can't answer.
    GlobalSecondaryIndexes: [
      {
        IndexName: "GSI1",
        KeySchema: [
          { AttributeName: "GSI1PK", KeyType: "HASH" },
          { AttributeName: "GSI1SK", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],

    BillingMode: "PAY_PER_REQUEST",
  }),
);

console.log("app-table created:", response.TableDescription?.TableStatus);
