Day 29 of the 30-day challenge: WebAssembly. I took one function, counting the primes up to n with a sieve, wrote it in Rust and compiled it to WebAssembly. Then I called it from Node and timed it against the same function in JavaScript for three input sizes.

My guesses first: WASM would be 3 times faster at the biggest size, 100,000,000. It was faster, but by much less. By the median, the ratio of WASM time to JS time was 0.62 at 10,000, 0.57 at 1,000,000, and 0.79 then 0.70 at 100,000,000 across two runs. That is about 1.6 times, 1.75 times, and 1.3 to 1.4 times faster. Both versions returned the same count at every size.

I also guessed there would be a size where WASM is slower. By the median there was none. The only slower case was the very first call at 10,000 in one of the two runs: 0.915 ms against 0.454 ms for JavaScript. In the other run the same call was faster in WASM. The ratio at the biggest size moved between runs, so I would not trust it to better than about 10 points.

What I did not test: other kinds of functions, strings or arrays crossing between JS and WASM, a browser, other compiler flags, memory, and why the .wasm file is 1.6 MB. It was one machine and plain numbers only, and the JavaScript is the simple version. The starter code was written by Claude, and I built it and measured it. Full writeup on the blog: <link>

#30DayChallenge #WebAssembly #Rust #NodeJS #Performance #SoftwareEngineering
