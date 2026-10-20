# Day 29 — WebAssembly: Rust to JS

Short format (about 90 minutes). One Rust function, compiled to WebAssembly and called from Node,
timed against the same function in JavaScript for 3 input sizes.

The function counts the primes up to n with a sieve (`src/lib.rs` in Rust, `countPrimesJS` in `src/bench.js`).
Both use the same algorithm. Sizes: 10,000, 1,000,000 and 100,000,000.

## Predictions (5 min) — write them in `solution.md` BEFORE running anything

1. At the biggest size (100,000,000), is WASM faster or slower than JavaScript, and by what factor (a number, for example "2 times faster")?
2. Is there any size where WASM is slower than JavaScript? Which one?

## Part A: build it (about 40 min)

1. Install Rust if you do not have it: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh` (it asks questions, the default is fine). Open a new terminal, then check `rustc --version`.
2. Add the WASM target: `rustup target add wasm32-unknown-unknown`
3. `cd src`, then read `lib.rs`. The line `#[no_mangle] pub extern "C"` makes the function visible to JavaScript. The function takes and returns plain numbers, so no extra tools are needed.
4. Check the algorithm natively first (this is not WASM): `rustc --test -O lib.rs -o lib_test && ./lib_test`
5. Build the WASM file: `npm run build`. Look at the file size of `count_primes.wasm` (`ls -l count_primes.wasm`).

## Part B: measure (about 30 min)

1. Read `bench.js`: JavaScript and WASM run one after the other for each run, so neither is always first. It prints the first run, the median and the minimum.
2. `npm run bench` (takes about 10 to 30 seconds). Then run it a second time.
3. Look at the line "wasm median / js median" for each size: below 1 means WASM was faster.

## Save in `solution.md`

- The output of both bench runs (paste it).
- For each size: which one was faster and by what factor, and where WASM was slower (if anywhere).
- The wasm file size, and the compile and instantiate times printed on the first line.
- The first run compared with the median for each size.

## Not today

wasm-bindgen, wasm-pack, passing strings or arrays between JS and WASM, running in the browser, SIMD or threads,
changing the algorithm to make a result look better, other Rust flags.
