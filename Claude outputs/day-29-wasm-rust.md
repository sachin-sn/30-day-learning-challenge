---
title: "Day 29 — Rust in WebAssembly Was 1.3 to 1.75 Times Faster Than My JavaScript, Not 3"
date: "2026-10-20"
excerpt: "I compiled one Rust function to WebAssembly, called it from Node, and timed it against the same function in JavaScript for three input sizes. WASM was faster at all three, but by much less than I guessed."
tags: ["30-day-challenge", "day-29", "webassembly", "rust", "nodejs", "performance"]
draft: true
---

Day 28 measured two front-end ideas. Day 29 goes lower: take one function, write it
in Rust, compile it to WebAssembly, call it from Node, and time it against the same
function in JavaScript. It is the short 90-minute format again.

## The function

The starter code came with the challenge, written by Claude, and my job was to build
it and measure it. The function counts the primes up to n with a sieve. The Rust
version is in `lib.rs`, the JavaScript version is in `bench.js`, and both use the
same algorithm: an array of flags, and for each prime, mark its multiples.

In Rust, `#[no_mangle] pub extern "C"` makes the function visible to JavaScript. It
takes and returns plain numbers, so no extra tools like wasm-bindgen were needed.
One detail: `usize` is only 32 bits in WebAssembly, so the loop uses `u64` for `i * i`,
otherwise it would overflow for large `i`. I built it with
`rustc --target wasm32-unknown-unknown -O --crate-type cdylib -C panic=abort`
(Rust 1.99.1, Node v22.2.0). A native test with known prime counts passed first. The
`.wasm` file is 1,655,347 bytes, and I did not look into why it is that big.

I wrote two predictions before running anything. At 100,000,000 I said WASM would be 3
times faster. For the second question, whether there is a size where WASM is slower,
I wrote "at 10 times the size of javascript", without naming a size.

## The numbers

I ran `npm run bench` twice. For each size, JS and WASM run one after the other, so
neither is always first. The table shows the median, in ms.

```
size          js (ms)    wasm (ms)   wasm / js
10,000        0.034      0.021       0.62   (both runs)
1,000,000     3.9        2.2         0.57   (both runs)
100,000,000   602.7      476.1       0.79   (run 1)
100,000,000   638.7      448.5       0.70   (run 2)
```

WASM was faster at all three sizes: about 1.6 times at 10,000, 1.75 times at
1,000,000, and 1.3 to 1.4 times at 100,000,000. My 3 times was wrong. Both
versions returned the same count at every size (1229, 78498 and 5761455).

By the median, WASM was not slower at any size. The only slower case was the first
call at 10,000 in run 1: 0.915 ms for WASM against 0.454 ms for JavaScript. In run 2
the same first call was faster in WASM, 0.379 ms against 0.487 ms. Compiling the 1.6 MB
file took 2.42 ms in run 1 and 0.43 ms in run 2, and instantiating took 0.14 ms and
0.07 ms.

At 100,000,000 the ratio moved from 0.79 to 0.70 between the two runs, with 5 runs
each, so I would not trust it to better than about 10 percentage points.

## What this does not show

It is one function on one machine with one Node version. A function with strings,
objects or many small calls could behave differently, and here only plain numbers
cross between JS and WASM. I built with `-O` only, without other flags or
`wasm-opt`. The JavaScript is the plain version with a `Uint8Array`, so "faster"
means faster than this JS code. I did not run it in a browser, and I did not measure
memory. I also did not test sizes between the three.

## What's next

Day 30 is the capstone: connect two earlier pieces and show one request going through
both, with a trace or a log. Full code in the [repo](#) — `day-29-wasm-rust/`.
