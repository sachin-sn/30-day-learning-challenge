// Usage: node measure.js [baseUrl]    (the app must be running: npm run build && npm start)
// For each page: fetch the HTML, find the <script src> files, download them, add up the sizes.
import { gzipSync } from "node:zlib";

const base = process.argv[2] ?? "http://localhost:3000";
const pages = ["/", "/server", "/client"];

for (const page of pages) {
  const html = await (await fetch(base + page)).text();
  const srcs = [...new Set([...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]))];
  let raw = 0;
  let gz = 0;
  for (const src of srcs) {
    const buf = Buffer.from(await (await fetch(new URL(src, base))).arrayBuffer());
    raw += buf.length;
    gz += gzipSync(buf).length;
  }
  const hasText = html.includes("same markdown");
  console.log(
    `${page.padEnd(8)} scripts: ${String(srcs.length).padStart(2)}   raw: ${(raw / 1024).toFixed(1).padStart(7)} kB   gzip: ${(gz / 1024).toFixed(1).padStart(6)} kB   html: ${(html.length / 1024).toFixed(1)} kB   text "same markdown" in the HTML: ${hasText ? "yes" : "no"}`,
  );
}
