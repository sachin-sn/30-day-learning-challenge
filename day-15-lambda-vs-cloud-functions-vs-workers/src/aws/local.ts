// Calls the Lambda handler with a fake Function URL event. No AWS needed.
import { handler } from "./index";

const ev = (path: string, query?: Record<string, string>) => ({
  rawPath: path,
  queryStringParameters: query,
  requestContext: { http: { method: "GET" } },
});

console.log(await handler(ev("/hash", { input: "abc" })));
for (let i = 0; i < 5; i++) console.log(await handler(ev("/info")));
console.log(await handler(ev("/nope")));
