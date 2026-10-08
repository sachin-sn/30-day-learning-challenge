// Part 3: sends N increments at the same time and shows what happened.
// usage: npx tsx load.ts <base-url> <kv|do> [n=50]
// e.g.   npx tsx load.ts https://day16-edge.day15-hash.workers.dev kv 50
export {};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [base, kind, nArg] = process.argv.slice(2);
  if (!base || (kind !== "kv" && kind !== "do")) {
    console.error("usage: npx tsx load.ts <base-url> <kv|do> [n=50]");
    process.exit(1);
  }
  const n = Number(nArg ?? 50);
  const url = `${base}/count/${kind}`;

  await fetch(`${url}/reset`, { method: "POST" });
  await sleep(1500); // KV allows one write per second to the same key

  const t0 = performance.now();
  const results = await Promise.all(
    Array.from({ length: n }, async () => {
      try {
        const res = await fetch(url, { method: "POST" });
        const body: any = await res.json();
        return { status: res.status, value: body.value as number | undefined, error: body.error as string | undefined };
      } catch (err) {
        return { status: 0, value: undefined, error: String(err) };
      }
    }),
  );
  const ms = performance.now() - t0;
  await sleep(1500);

  const final: any = await (await fetch(url)).json();
  const ok = results.filter((r) => r.status === 200);
  const values = ok.map((r) => r.value as number).sort((a, b) => a - b);
  const distinct = new Set(values);
  const errors = new Map<string, number>();
  for (const r of results.filter((r) => r.status !== 200)) {
    const key = `${r.status} ${(r.error ?? "").slice(0, 80)}`;
    errors.set(key, (errors.get(key) ?? 0) + 1);
  }

  console.log(`store=${kind}  sent=${n}  ok=${ok.length}  failed=${n - ok.length}  took=${ms.toFixed(0)} ms`);
  console.log(`final value read afterwards: ${final.value}   (a correct counter ends at ${n})`);
  console.log(`values returned: ${distinct.size} distinct, min=${values[0]}, max=${values[values.length - 1]}`);
  console.log(`sorted values: ${values.join(" ")}`);
  for (const [k, v] of errors) console.log(`failure x${v}: ${k}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
