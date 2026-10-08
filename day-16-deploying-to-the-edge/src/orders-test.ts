// Part 4: sends signed and bad requests to /orders and prints timings.
// The secret is read from .dev.vars (ORDERS_SECRET=...). It is never printed.
// usage: npx tsx orders-test.ts <edge-base-url> <origin-base-url> [n=20]
export {};

import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

function loadSecret(): string {
  if (process.env.ORDERS_SECRET) return process.env.ORDERS_SECRET;
  const line = readFileSync(".dev.vars", "utf8")
    .split("\n")
    .find((l) => l.startsWith("ORDERS_SECRET="));
  if (!line) throw new Error("ORDERS_SECRET not found in .dev.vars");
  return line.slice("ORDERS_SECRET=".length).trim();
}

const sign = (secret: string, ts: string, body: string) =>
  createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");

const pct = (a: number[], p: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};

async function originCount(origin: string): Promise<number> {
  return ((await (await fetch(`${origin}/orders-count`)).json()) as any).orderHits;
}

async function main() {
  const [edge, origin, nArg] = process.argv.slice(2);
  if (!edge || !origin) {
    console.error("usage: npx tsx orders-test.ts <edge-base-url> <origin-base-url> [n=20]");
    process.exit(1);
  }
  const n = Number(nArg ?? 20);
  const secret = loadSecret();
  const now = () => String(Math.floor(Date.now() / 1000));

  const groups: Record<string, () => { ts: string; sig: string; body: string }> = {
    "valid": () => {
      const body = JSON.stringify({ order: randomBytes(4).toString("hex") });
      const ts = now();
      return { ts, sig: sign(secret, ts, body), body };
    },
    "wrong signature": () => {
      const body = JSON.stringify({ order: randomBytes(4).toString("hex") });
      const ts = now();
      return { ts, sig: sign("not-the-secret", ts, body), body };
    },
    "old timestamp (10 min)": () => {
      const body = JSON.stringify({ order: randomBytes(4).toString("hex") });
      const ts = String(Math.floor(Date.now() / 1000) - 600);
      return { ts, sig: sign(secret, ts, body), body }; // signed correctly, but too old
    },
  };

  const before = await originCount(origin);
  console.log(`origin orderHits before: ${before}`);

  for (const [name, make] of Object.entries(groups)) {
    const times: number[] = [];
    const statuses = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      const { ts, sig, body } = make();
      const t0 = performance.now();
      const res = await fetch(`${edge}/orders`, {
        method: "POST",
        headers: { "x-timestamp": ts, "x-signature": sig, "content-type": "application/json" },
        body,
      });
      await res.text();
      times.push(performance.now() - t0);
      statuses.set(res.status, (statuses.get(res.status) ?? 0) + 1);
    }
    const st = [...statuses].map(([k, v]) => `${k}x${v}`).join(" ");
    console.log(
      `${name.padEnd(24)} n=${n}  status ${st}  median=${pct(times, 50).toFixed(1)} ms  p95=${pct(times, 95).toFixed(1)} ms`,
    );
  }

  const after = await originCount(origin);
  console.log(`origin orderHits after: ${after}   (increase = ${after - before}; only the valid group should add to it)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
