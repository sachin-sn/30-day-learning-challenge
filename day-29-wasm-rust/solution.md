# Day 29 — WebAssembly: Rust to JS

## Predictions (written before running anything)

1. At 100,000,000, is WASM faster or slower than JavaScript, and by what factor: "3 times faster"
2. Is there any size where WASM is slower than JavaScript, and which: "at 10 times the size of javascript" (no size named)

## Output

Rust `rustc 1.99.1 (58cf8f9c3 2026-10-13)`, Node v22.2.0, built with `rustc --target wasm32-unknown-unknown -O --crate-type cdylib -C panic=abort`. The native test (`known_counts`) passed. `count_primes.wasm` is 1,655,347 bytes; imports: 0. I did not look into why it is that big.

### `npm run bench`, run 1

```
wasm file: 1655347 bytes   compile: 2.42 ms   instantiate: 0.14 ms   imports: 0
size          impl   runs   first (ms)   median (ms)   min (ms)   result
      10000   js      200       0.454        0.034       0.033   1229
      10000   wasm    200       0.915        0.021       0.021   1229
            wasm median / js median: 0.62   (same result)
    1000000   js       20         4.8          3.9         3.8   78498
    1000000   wasm     20         2.4          2.2         2.2   78498
            wasm median / js median: 0.57   (same result)
  100000000   js        5       578.2        602.7       578.2   5761455
  100000000   wasm      5       456.2        476.1       456.2   5761455
            wasm median / js median: 0.79   (same result)
```

### `npm run bench`, run 2

```
wasm file: 1655347 bytes   compile: 0.43 ms   instantiate: 0.07 ms   imports: 0
size          impl   runs   first (ms)   median (ms)   min (ms)   result
      10000   js      200       0.487        0.034       0.033   1229
      10000   wasm    200       0.379        0.021       0.021   1229
            wasm median / js median: 0.62   (same result)
    1000000   js       20         5.0          3.9         3.8   78498
    1000000   wasm     20         2.3          2.2         2.2   78498
            wasm median / js median: 0.57   (same result)
  100000000   js        5       603.6        638.7       603.6   5761455
  100000000   wasm      5       456.2        448.5       439.3   5761455
            wasm median / js median: 0.70   (same result)
```

### Reading the numbers

- By the median, WASM was faster at all 3 sizes in both runs. The ratio (wasm / js) was 0.62 at 10,000, 0.57 at 1,000,000, and 0.79 then 0.70 at 100,000,000. That is about 1.6 times, 1.75 times, and 1.3 to 1.4 times faster.
- My prediction of "3 times faster" at 100,000,000 was wrong: it was 1.3 to 1.4 times faster.
- My second prediction ("at 10 times the size of javascript", no size named) does not match anything I measured: by the median WASM was not slower at any size. The only case where WASM was slower: the first call at 10,000 in run 1 (0.915 ms against 0.454 ms for JS). In run 2 the first call at 10,000 was faster in WASM (0.379 ms against 0.487 ms).
- Both implementations returned the same count at every size (1229, 78498, 5761455).
- Compile time of the 1.6 MB file was 2.42 ms in run 1 and 0.43 ms in run 2; instantiate was 0.14 ms and 0.07 ms.
- Run to run, the medians at 1,000,000 and 10,000 were the same to the digits shown. At 100,000,000 the JS median was 602.7 ms then 638.7 ms, and the WASM median 476.1 ms then 448.5 ms (5 runs each), which is why the ratio moved from 0.79 to 0.70.

## What I learned (3 sentences)

TODO

## Not measured / still open

- One function (a prime sieve), one machine, Node v22.2.0 only. A function with other work (strings, objects, many small calls) could behave differently.
- The WASM was built with `-O` only. I did not try other Rust flags, `wasm-opt`, or stripping, and I did not look at why the file is 1.6 MB.
- Only plain numbers go between JS and WASM here. Passing strings or arrays, and the cost of that, were not measured.
- Not run in a browser. Memory use not measured.
- The JS version is the straightforward one (`Uint8Array`). I did not try to optimize it further, so "WASM is faster" here means faster than this JS code.
- The 5 runs at 100,000,000 moved the ratio from 0.79 to 0.70 between the two bench runs, so I would not trust a ratio to better than about 10 percentage points. Sizes between the three were not tried.

## Link

TODO: docs link with one sentence
