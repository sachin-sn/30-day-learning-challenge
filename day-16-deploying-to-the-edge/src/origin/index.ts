// The slow origin for Part 2. It waits 2 seconds, then answers.
// `hits` and `at` show whether a response came from this code or from a cache:
// a cached copy has the same `at` as the first answer.

let hits = 0; // per instance, not a global count (see Day 15)
let orderHits = 0; // Part 4: how many signed orders reached the origin (per instance)

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Part 4: fast answer, no wait. Only the edge Worker should call this after checking the signature.
    if (request.method === "POST" && url.pathname === "/orders") {
      orderHits += 1;
      return Response.json({ ok: true, orderHits });
    }
    if (request.method === "GET" && url.pathname === "/orders-count") {
      return Response.json({ orderHits });
    }

    if (request.method !== "GET" || url.pathname !== "/") {
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    hits += 1;
    const started = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 2000));

    return Response.json({
      origin: "day16-origin",
      hits,
      waitedMs: Date.now() - started,
      at: new Date().toISOString(),
    });
  },
};
