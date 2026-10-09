import express, { Express } from "express";
import { SpanStatusCode, trace } from "@opentelemetry/api";
const tracer = trace.getTracer("day18");

const PORT: number = parseInt(process.env.PORT || "3000");
const app: Express = express();

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getRandomInt(min: number, max: number) {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled); // The maximum is exclusive and the minimum is inclusive
}

async function slowLookup(ms: number) {
  return tracer.startActiveSpan("slowLookup", async (span) => {
    await new Promise((r) => setTimeout(r, ms));
    span.end();
  });
}

///hash?input=abc
app.get("/hash", async (req, res) => {
  const input = req.query?.input?.toString() ?? "";
  const timeOut = getRandomInt(1, 4) * 100; // getting some random timeout between 100 - 300 ms
  await slowLookup(timeOut);
  res.send({ input, sha256: await sha256Hex(input) });
});

///fail
app.get("/fail", async (req, res) => {
  await tracer.startActiveSpan("failWork", async (span) => {
    try {
      throw new Error("something broke");
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: (err as Error).message,
      });
      res.status(500).send({ error: "internal error" });
    } finally {
      span.end();
    }
  });
});

app.listen(PORT, () => {
  console.log(`Listening for requests on http://localhost:${PORT}`);
});
