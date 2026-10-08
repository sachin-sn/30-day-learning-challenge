import http, { IncomingMessage, ServerResponse } from "node:http";
import { handle } from "./core";

const PORT = Number(process.env.PORT ?? 8080);

const server = http.createServer(
  (req: IncomingMessage, res: ServerResponse) => {
    // Collect the body as raw text. A GET has no body, so this stays "".
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));

    req.on("end", async () => {
      const started = Date.now();
      try {
        // req.url is only a path like "/hash?input=abc", so give URL a base.
        const url = new URL(req.url ?? "/", "http://localhost");

        // Health check: does not go through handle(), so it is not counted.
        if (req.method === "GET" && url.pathname === "/healthz") {
          res.writeHead(200, { "content-type": "text/plain" });
          res.end("ok");
          return;
        }

        const out = await handle({
          method: req.method ?? "GET",
          path: url.pathname,
          query: Object.fromEntries(url.searchParams),
          body: Buffer.concat(chunks).toString("utf8"),
        });

        res.writeHead(out.status, out.headers);
        res.end(out.body); // out.body is already a JSON string.
      } catch (err) {
        console.error(err);
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "internal error" }));
      } finally {
        console.log(
          `${req.method} ${req.url} ${res.statusCode} ${Date.now() - started}ms`,
        );
      }
    });
  },
);

server.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
