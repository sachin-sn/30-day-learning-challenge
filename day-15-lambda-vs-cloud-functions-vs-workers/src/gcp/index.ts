import * as functions from "@google-cloud/functions-framework";
import { handle } from "../core";

// HTTP function. req and res are Express objects.
functions.http("app", async (req, res) => {
  const out = await handle({
    method: req.method,
    path: req.path,
    query: req.query as Record<string, string>,
    body: typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? ""),
  });
  res.status(out.status).set(out.headers).send(out.body);
});
