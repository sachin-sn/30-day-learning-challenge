import { DurableObject } from "cloudflare:workers";

interface Env {
  ORIGIN_URL: string; // set in wrangler.toml [vars]
  ORDERS_SECRET: string; // secret: .dev.vars locally, `wrangler secret put` when deployed
  COUNTER_KV: KVNamespace; // Part 3: Workers KV (eventually consistent)
  COUNTER_DO: DurableObjectNamespace<Counter>; // Part 3: Durable Object (one writer)
}

// Part 3: one Durable Object holds the counter. All calls for the same name reach
// the same object, and its SQL calls below have no `await` between read and write.
export class Counter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS counter (id INTEGER PRIMARY KEY, n INTEGER NOT NULL)",
      );
      ctx.storage.sql.exec("INSERT OR IGNORE INTO counter (id, n) VALUES (1, 0)");
    });
  }

  increment(): number {
    this.ctx.storage.sql.exec("UPDATE counter SET n = n + 1 WHERE id = 1");
    return this.get();
  }

  get(): number {
    return this.ctx.storage.sql.exec("SELECT n FROM counter WHERE id = 1").one().n as number;
  }

  reset(): number {
    this.ctx.storage.sql.exec("UPDATE counter SET n = 0 WHERE id = 1");
    return 0;
  }
}

const TTL_SECONDS = 30;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // GET, and HEAD (some online testing tools send HEAD), on /where
    if (
      (request.method === "GET" || request.method === "HEAD") &&
      url.pathname === "/where"
    ) {
      const cf = request.cf; // may be undefined, so check it
      return Response.json(
        {
          colo: cf?.colo,
          country: cf?.country,
          httpProtocol: cf?.httpProtocol,
          tlsVersion: cf?.tlsVersion,
          clientTcpRtt: cf?.clientTcpRtt,
        },
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "x-colo": String(cf?.colo ?? "unknown"),
            "Access-Control-Allow-Origin": "*", // Optional: Allows CORS requests
          },
        },
      );
    }

    // Part 2, version A: Cache API (caches.default). The docs say where this works.
    if (request.method === "GET" && url.pathname === "/slow-cacheapi") {
      const started = Date.now();
      const cache = caches.default;
      const key = new Request(new URL("/slow-cacheapi", request.url).toString());

      const cached = await cache.match(key);
      if (cached) {
        const cachedAt = Number(cached.headers.get("x-cached-at"));
        return withHeaders(cached, {
          "x-cache": "HIT",
          "x-age-s": String(Math.round((Date.now() - cachedAt) / 1000)),
          "x-edge-ms": String(Date.now() - started),
          "x-colo": String(request.cf?.colo ?? "unknown"),
        });
      }

      const origin = await fetch(env.ORIGIN_URL);
      const body = await origin.text();
      const toStore = new Response(body, {
        status: origin.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${TTL_SECONDS}`,
          "x-cached-at": String(Date.now()),
        },
      });
      ctx.waitUntil(cache.put(key, toStore.clone()));
      return withHeaders(toStore, {
        "x-cache": "MISS",
        "x-age-s": "0",
        "x-edge-ms": String(Date.now() - started),
        "x-colo": String(request.cf?.colo ?? "unknown"),
      });
    }

    // Part 2, version B: fetch() with cf cache options. Caches the origin's answer.
    if (request.method === "GET" && url.pathname === "/slow") {
      const started = Date.now();
      let origin: Response;
      try {
        origin = await fetch(env.ORIGIN_URL, {
          cf: { cacheEverything: true, cacheTtl: TTL_SECONDS },
        });
      } catch (err) {
        return Response.json(
          { error: "origin fetch failed", detail: String(err) },
          { status: 502 },
        );
      }
      const body = await origin.text();
      return new Response(body, {
        status: origin.status,
        headers: {
          "Content-Type": "application/json",
          // cf-cache-status comes from Cloudflare: HIT, MISS, EXPIRED, DYNAMIC, BYPASS ...
          "x-cache": origin.headers.get("cf-cache-status") ?? "none",
          "x-age-s": origin.headers.get("age") ?? "none",
          "x-origin-status": String(origin.status),
          "x-edge-ms": String(Date.now() - started),
          "x-colo": String(request.cf?.colo ?? "unknown"),
        },
      });
    }

    // Part 3: counters. KV does read, add 1, write (not atomic). The Durable Object does it in one place.
    if (url.pathname.startsWith("/count/")) {
      const [, , which, action] = url.pathname.split("/"); // /count/<kv|do>[/reset]
      const kind = which === "kv" || which === "do" ? which : null;
      const isReset = action === "reset" && request.method === "POST";
      const isInc = action === undefined && request.method === "POST";
      const isGet = action === undefined && request.method === "GET";
      if (kind && (isReset || isInc || isGet)) {
        try {
          let value: number;
          if (kind === "kv") {
            const current = Number((await env.COUNTER_KV.get("n")) ?? "0");
            if (isReset) {
              await env.COUNTER_KV.put("n", "0");
              value = 0;
            } else if (isInc) {
              value = current + 1;
              await env.COUNTER_KV.put("n", String(value));
            } else {
              value = current;
            }
          } else {
            const stub = env.COUNTER_DO.getByName("global");
            value = isReset ? await stub.reset() : isInc ? await stub.increment() : await stub.get();
          }
          return Response.json(
            { store: kind, value },
            { headers: { "x-colo": String(request.cf?.colo ?? "unknown") } },
          );
        } catch (err) {
          return Response.json({ store: kind, error: String(err) }, { status: 500 });
        }
      }
    }

    // Part 4: check a signed request at the edge, then pass it to the origin.
    if (request.method === "POST" && url.pathname === "/orders") {
      return handleOrder(request, env);
    }

    // Default response for unhandled endpoints or methods
    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
};

function withHeaders(res: Response, extra: Record<string, string>): Response {
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(extra)) out.headers.set(k, v);
  return out;
}

const encoder = new TextEncoder();
const MAX_AGE_SECONDS = 300;

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) return null; // SHA-256 = 32 bytes = 64 hex characters
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// Signature = HMAC-SHA256(secret, `${x-timestamp}.${body}`), written as hex.
async function handleOrder(request: Request, env: Env): Promise<Response> {
  const started = Date.now();
  const colo = String(request.cf?.colo ?? "unknown");
  const reject = (why: string): Response => {
    console.log("rejected:", why); // reason goes to `wrangler tail`, not to the caller
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: { "x-edge-ms": String(Date.now() - started), "x-colo": colo } },
    );
  };

  if (!env.ORDERS_SECRET) return Response.json({ error: "secret not set" }, { status: 500 });

  const timestamp = request.headers.get("x-timestamp");
  const signature = request.headers.get("x-signature");
  const body = await request.text();
  if (!timestamp || !signature) return reject("missing header");

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return reject("bad timestamp");
  if (Math.abs(Date.now() / 1000 - ts) > MAX_AGE_SECONDS) return reject("timestamp too old or too new");

  const given = hexToBytes(signature);
  if (!given) return reject("bad signature format");

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(env.ORDERS_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`));
  if (!crypto.subtle.timingSafeEqual(expected, given)) return reject("signature does not match");

  const origin = await fetch(new URL("/orders", env.ORIGIN_URL), { method: "POST", body });
  return new Response(await origin.text(), {
    status: origin.status,
    headers: {
      "Content-Type": "application/json",
      "x-edge-ms": String(Date.now() - started),
      "x-colo": colo,
    },
  });
}
