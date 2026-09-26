import {
  DynamoDBClient,
  CreateTableCommand,
  ListTablesCommand,
} from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({
  endpoint: "http://localhost:8000",
  region: "us-east-1",
  credentials: { accessKeyId: "local", secretAccessKey: "local" }, // dummy — Local doesn't check these
});

await client.send(
  new CreateTableCommand({
    TableName: "verify-table",
    AttributeDefinitions: [{ AttributeName: "PK", AttributeType: "S" }],
    KeySchema: [{ AttributeName: "PK", KeyType: "HASH" }],
    BillingMode: "PAY_PER_REQUEST",
  }),
);

console.log(await client.send(new ListTablesCommand({})));
