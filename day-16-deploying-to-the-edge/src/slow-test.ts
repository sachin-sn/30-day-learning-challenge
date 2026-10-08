// Calls one URL N times in a row and prints status, cache headers and time.
// usage: npx tsx slow-test.ts <url> [count=10] [pauseMs=0]
// e.g.   npx tsx slow-test.ts https://day16-edge.day15-hash.workers.dev/slow 10
export {};

async function main() {
  const [url, countArg, pauseArg] = process.argv.slice(2);
  if (!url) {
    console.error("usage: npx tsx slow-test.ts <url> [count=10] [pauseMs=0]");
    process.exit(1);
  }
  const count = Number(countArg ?? 10);
  const pauseMs = Number(pauseArg ?? 0);

  for (let i = 1; i <= count; i++) {
    const t0 = performance.now();
    const res = await fetch(url);
    const text = await res.text();
    const ms = performance.now() - t0;
    let at = "?";
    try {
      at = JSON.parse(text).at ?? "?";
    } catch {
      at = text.slice(0, 40);
    }
    console.log(
      `${String(i).padStart(2)}  ${res.status}  ${ms.toFixed(1).padStart(7)} ms  ` +
        `x-cache=${res.headers.get("x-cache")}  age=${res.headers.get("x-age-s")}  ` +
        `edge=${res.headers.get("x-edge-ms")}ms  colo=${res.headers.get("x-colo")}  at=${at}`,
    );
    if (pauseMs > 0) await new Promise((r) => setTimeout(r, pauseMs));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
