type Req = {
  method: string;
  path: string;
  query: Record<string, string>;
  body: string;
};
type Res = { status: number; headers: Record<string, string>; body: string };

// Module level: runs once when an instance starts, not once per request.
// This is what makes a cold start visible in /info.
const t0 = performance.now();
// Workers does not allow random values in global scope, so the ID is created
// on the first request. It is still created once per instance (isolate).
let instanceId: string | undefined;
let requestCount = 0;
const initMs = performance.now() - t0;

const json = (status: number, data: unknown): Res => ({
  status,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(data),
});

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Changed from the stub: it returns Promise<Res>, because crypto.subtle is
// async. (node:crypto has a sync hash, but Workers does not have it by default.)
export async function handle(req: Req): Promise<Res> {
  requestCount++;
  if (req.method === "GET" && req.path === "/hash") {
    const input = req.query.input ?? "";
    return json(200, { input, sha256: await sha256Hex(input) });
  }
  if (req.method === "GET" && req.path === "/info") {
    instanceId ??= crypto.randomUUID();
    return json(200, { instanceId, requestCount, initMs, version: "v2" });
  }
  return json(404, { error: "not found" });
}
