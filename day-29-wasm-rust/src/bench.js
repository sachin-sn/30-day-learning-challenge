// Times count_primes in JavaScript and in WASM (built from lib.rs) for 3 input sizes.
// Usage: npm run build   (once, needs Rust)   then   npm run bench
import { readFileSync } from "node:fs";

function countPrimesJS(n) {
  if (n < 2) return 0;
  const composite = new Uint8Array(n + 1);
  let count = 0;
  for (let i = 2; i <= n; i++) {
    if (composite[i] === 0) {
      count++;
      for (let j = i * i; j <= n; j += i) composite[j] = 1;
    }
  }
  return count;
}

const SIZES = [
  { n: 10_000, runs: 200 },
  { n: 1_000_000, runs: 20 },
  { n: 100_000_000, runs: 5 },
];

// --- load the WASM module (timed once) ---
const bytes = readFileSync(new URL("./count_primes.wasm", import.meta.url));
const t0 = performance.now();
const module = await WebAssembly.compile(bytes);
const t1 = performance.now();
const instance = await WebAssembly.instantiate(module, {});
const t2 = performance.now();
const imports = WebAssembly.Module.imports(module);
const countPrimesWasm = instance.exports.count_primes;
console.log(`wasm file: ${bytes.length} bytes   compile: ${(t1 - t0).toFixed(2)} ms   instantiate: ${(t2 - t1).toFixed(2)} ms   imports: ${imports.length}`);
console.log(`node ${process.version}\n`);

function time(fn, n) {
  const t = performance.now();
  const result = fn(n);
  return { ms: performance.now() - t, result };
}
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const fmt = (ms) => (ms < 1 ? ms.toFixed(3) : ms.toFixed(1)).padStart(9);

console.log("size          impl   runs   first (ms)   median (ms)   min (ms)   result");
for (const { n, runs } of SIZES) {
  const js = [];
  const wasm = [];
  let jsResult;
  let wasmResult;
  for (let r = 0; r < runs; r++) {
    // alternate JS and WASM so neither always runs first
    const a = time(countPrimesJS, n);
    const b = time(countPrimesWasm, n);
    js.push(a.ms);
    wasm.push(b.ms);
    jsResult = a.result;
    wasmResult = b.result;
  }
  const row = (name, arr, res) =>
    `${String(n).padStart(11)}   ${name.padEnd(5)}  ${String(runs).padStart(4)}   ${fmt(arr[0])}    ${fmt(median(arr))}   ${fmt(Math.min(...arr))}   ${res}`;
  console.log(row("js", js, jsResult));
  console.log(row("wasm", wasm, wasmResult));
  const same = jsResult === wasmResult ? "same result" : "DIFFERENT RESULTS";
  console.log(`            wasm median / js median: ${(median(wasm) / median(js)).toFixed(2)}   (${same})\n`);
}
