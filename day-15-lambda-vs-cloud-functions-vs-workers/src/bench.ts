// usage: npx tsx src/bench.ts https://your-url
export {};
const base = process.argv[2];
if (!base) throw new Error("usage: bench.ts <base-url>");

async function timed(path: string) {
  const t = performance.now();
  const r = await fetch(base + path);
  const body = await r.json();
  return { ms: performance.now() - t, body, status: r.status };
}

const first = await timed("/info");
console.log("first request:", first.ms.toFixed(1), "ms", first.body);

const times: number[] = [];
const ids = new Set<string>();
for (let i = 0; i < 30; i++) {
  const r = await timed("/info");
  times.push(r.ms);
  ids.add((r.body as { instanceId: string }).instanceId);
}
times.sort((a, b) => a - b);
const q = (p: number) => times[Math.min(times.length - 1, Math.ceil(p * times.length) - 1)];
console.log("next 30: median", q(0.5).toFixed(1), "ms, p95", q(0.95).toFixed(1), "ms");
console.log("distinct instanceId in the 30:", ids.size);
