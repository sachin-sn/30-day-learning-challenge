import { handle } from "../core";

// Function URL, payload format 2.0 (only the fields we use).
type UrlEvent = {
  rawPath: string;
  queryStringParameters?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
  requestContext: { http: { method: string } };
};

export const handler = async (event: UrlEvent) => {
  const body = event.body
    ? event.isBase64Encoded
      ? Buffer.from(event.body, "base64").toString("utf8")
      : event.body
    : "";
  const res = await handle({
    method: event.requestContext.http.method,
    path: event.rawPath,
    query: event.queryStringParameters ?? {},
    body,
  });
  return { statusCode: res.status, headers: res.headers, body: res.body };
};
