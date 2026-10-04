/**
 * Part 5 — Redlock across 5 independent Redis instances.
 *
 * One Redis is a single point of failure: if it dies, nobody can lock (fail
 * closed) — or, with replication, a failover can hand the lock to a second
 * holder (fail open). Redlock instead asks 5 INDEPENDENT instances (separate
 * machines, no replication between them) and only counts the lock as held if
 * a MAJORITY (3 of 5) agreed, within the lock's own lifetime.
 *
 * Algorithm (from redis.io/docs/latest/develop/clients/patterns/distributed-locks):
 *   1. start = now
 *   2. try SET key token NX PX ttl on every instance, each with a short
 *      timeout so a dead instance can't eat the whole TTL
 *   3. elapsed  = now - start
 *      drift    = ttl * 0.01 + 2ms        (allowance for clock drift)
 *      validity = ttl - elapsed - drift   (time you may still safely work)
 *   4. acquired  <=>  votes >= 3  AND  validity > 0
 *   5. otherwise release on ALL instances (even ones that didn't answer) and fail
 *
 * Run it three times (see docker-compose.yml: redis-6379 .. redis-6383):
 *   all 5 up        -> expect acquire succeeds, 5/5
 *   stop 2 (3 up)   -> expect ???
 *   stop 3 (2 up)   -> expect ???
 *
 * Prediction (fill in before running):
 *   With 3 of 5 up, does the lock succeed?                 ______
 *   With 2 of 5 up, does the lock succeed?                 ______
 *   If the sum of two clients' votes can never exceed 5,
 *   can two clients both hold a majority?                  ______
 */
import Redis from "ioredis";
import { randomUUID } from "node:crypto";

const PORTS = [6379, 6380, 6381, 6382, 6383];
const QUORUM = Math.floor(PORTS.length / 2) + 1; // 3
const TTL_MS = 5000;
const PER_INSTANCE_TIMEOUT_MS = 100; // << TTL, so a dead node costs ~100ms, not 5s
const CLOCK_DRIFT_FACTOR = 0.01;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// One client per instance. Fail fast: no retries, no offline queue — a dead
// instance must answer "no" quickly instead of stalling the whole attempt.
const nodes = PORTS.map((port) => {
  const client = new Redis({
    host: process.env.REDIS_HOST ?? "127.0.0.1",
    port,
    lazyConnect: true,
    connectTimeout: PER_INSTANCE_TIMEOUT_MS,
    commandTimeout: PER_INSTANCE_TIMEOUT_MS,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null, // never reconnect in the background
  });
  client.on("error", () => {}); // errors are handled per call below
  return { port, client };
});

const RELEASE_SCRIPT = `
  if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
  else
    return 0
  end
`;

export interface RedlockLock {
  resource: string;
  key: string;
  token: string;
  votes: number;
  validityMs: number;
}

async function connectAll() {
  await Promise.all(
    nodes.map((n) => n.client.connect().catch(() => undefined)),
  );
}

async function vote(
  client: Redis,
  key: string,
  token: string,
  ttlMs: number,
): Promise<boolean> {
  try {
    return (await client.set(key, token, "PX", ttlMs, "NX")) === "OK";
  } catch {
    return false; // down / timed out / refused — counts as "no vote"
  }
}

async function unlockOn(
  client: Redis,
  key: string,
  token: string,
): Promise<void> {
  try {
    await client.eval(RELEASE_SCRIPT, 1, key, token);
  } catch {
    /* unreachable node: its copy will expire by TTL */
  }
}

export async function redlockAcquire(
  resource: string,
  ttlMs: number,
  verbose = true,
): Promise<RedlockLock | null> {
  const key = `lock:${resource}`;
  const token = randomUUID();
  const start = Date.now();

  const results = await Promise.all(
    nodes.map(async (n) => ({
      port: n.port,
      ok: await vote(n.client, key, token, ttlMs),
    })),
  );

  const votes = results.filter((r) => r.ok).length;
  const elapsed = Date.now() - start;
  const drift = Math.floor(ttlMs * CLOCK_DRIFT_FACTOR) + 2;
  const validityMs = ttlMs - elapsed - drift;

  if (verbose) {
    console.log(
      `  votes: ${results.map((r) => `${r.port}:${r.ok ? "yes" : "no"}`).join("  ")}`,
    );
    console.log(
      `  ${votes}/${nodes.length} votes (need ${QUORUM}), elapsed ${elapsed}ms, ` +
        `drift allowance ${drift}ms, validity ${validityMs}ms`,
    );
  }

  if (votes >= QUORUM && validityMs > 0) {
    return { resource, key, token, votes, validityMs };
  }

  // Failed: undo everything, including instances that timed out (they may have
  // applied the SET even though we never saw the reply).
  await Promise.all(nodes.map((n) => unlockOn(n.client, key, token)));
  return null;
}

export async function redlockRelease(lock: RedlockLock): Promise<void> {
  await Promise.all(nodes.map((n) => unlockOn(n.client, lock.key, lock.token)));
}

// ---------------------------------------------------------------------------
async function main() {
  await connectAll();
  const live: number[] = [];
  for (const n of nodes) {
    try {
      if ((await n.client.ping()) === "PONG") live.push(n.port);
    } catch {
      /* down */
    }
  }
  console.log(
    `Reachable instances: ${live.length}/${nodes.length}  [${live.join(", ")}]  (quorum = ${QUORUM})\n`,
  );

  const resource = `part5-${Date.now()}`;

  console.log("1) Client A acquires");
  const a = await redlockAcquire(resource, TTL_MS);
  console.log(
    a
      ? `  -> A HOLDS the lock (work for at most ${a.validityMs}ms)\n`
      : "  -> A FAILED to get a majority\n",
  );

  console.log(
    a ? "2) Client B tries while A holds it" : "2) Client B tries as well",
  );
  const b = await redlockAcquire(resource, TTL_MS);
  console.log(
    b
      ? "  -> B HOLDS the lock  *** two holders: BROKEN ***\n"
      : a
        ? "  -> B denied (correct: A holds a majority)\n"
        : "  -> B also fails (a majority simply isn't reachable)\n",
  );

  if (a) {
    await redlockRelease(a);
    console.log("3) A released on all instances");
    const c = await redlockAcquire(resource, TTL_MS);
    console.log(
      c ? "  -> C acquires immediately after release\n" : "  -> C failed\n",
    );
    if (c) await redlockRelease(c);
  }

  // Split-vote: X has already grabbed 2 instances (e.g. it stalled before
  // reaching the rest); Y then gets the other 3 and wins. X can never reach 3.
  if (live.length === nodes.length) {
    console.log(
      "4) Split vote: X already holds 2 instances, Y races for all 5",
    );
    const splitResource = `${resource}-split`;
    const splitKey = `lock:${splitResource}`;
    await nodes[0].client.set(splitKey, "X-token", "PX", TTL_MS, "NX");
    await nodes[1].client.set(splitKey, "X-token", "PX", TTL_MS, "NX");
    console.log(
      "  X holds 2 of 5 (needs 3 — it can only ever win if Y gives some back)",
    );
    const y = await redlockAcquire(splitResource, TTL_MS);
    console.log(
      y
        ? "  -> Y HOLDS the lock with 3 votes; X's 2 votes can't make a majority\n"
        : "  -> Y failed\n",
    );
    if (y) await redlockRelease(y);
    await Promise.all(
      nodes.slice(0, 2).map((n) => unlockOn(n.client, splitKey, "X-token")),
    );
  }

  await Promise.all(
    nodes.map((n) => n.client.quit().catch(() => n.client.disconnect())),
  );
}

main();
