---
title: "Day 28 — The Server Page Sent 45 kB Less, and the Signal Component Ran Once in 13 Clicks"
date: "2026-10-19"
excerpt: "I measured the JavaScript sent by a Next.js page that renders markdown in a Server Component and by one that does it in a Client Component, then counted renders for useState and signals in Preact. Both of my predictions were wrong."
tags: ["30-day-challenge", "day-28", "react-server-components", "signals", "nextjs", "preact"]
draft: true
---

Day 27 compared a local model with an API. Day 28 is about two ideas in front-end
work: React Server Components, and signals. I use React every day at work, but I had
not measured either of them. It is the short 90-minute format again.

## Two small apps

The starter code came with the challenge, written by Claude, and my job was to read
it, run it and measure it.

Part A is a Next.js app (version 16.4.2) with two pages that show the same markdown
text, turned into HTML with the `marked` library. On `/server` this happens in a
Server Component. On `/client` it happens in a Client Component, which is the line
`"use client"` at the top of the file. A small script, `measure.js`, downloads each
page, finds its `<script>` files, and adds up their sizes.

Part B is a small Preact app with two counters. One uses `useState`, and the parent
passes the count to a child. The other uses a signal and passes the signal itself to
the child. Every component function adds one to a counter each time it runs, and a
table on the page shows the numbers. I used Preact for this part, not React.

I wrote two predictions first. For Part A I said the server page would send more
JavaScript, by about 200 kB. For Part B I said every function would run 10 times
after 10 clicks.

## Part A: the server page sent less

```
page      scripts   raw       gzip
/         8         563.0 kB  174.1 kB
/server   7         555.4 kB  170.9 kB
/client   8         600.3 kB  184.5 kB
```

I had it backwards. The server page sent less JavaScript than the client page: 44.9 kB
less raw and 13.6 kB less gzip. My 200 kB was far too high.

Both pages already have the finished text in the HTML, so the client page also
renders on the server first. In the page source, the script lists are the same except
one extra file on `/client`, `0bc6gb6lxytnf.js`. The other files have the same names,
so that file is the whole 44.9 kB difference. In the terminal of `npm start` I saw
the `[server]` line for the server page, and also the line from the client component,
so both ran in the server process. The page source of `/server` has the finished
HTML a second time, as a string inside the `self.__next_f.push(...)` data. The
`/client` source has a reference to the client component there instead.

## Part B: the signal component ran once

```
component      times its function ran
StateParent    11
StateChild     11
SignalParent   1
SignalChild    1
```

The useState components ran 11 times each: one first render and 10 clicks. My "10
times" was off by one for them, and wrong for the signal pair. The signal components
ran once, even though I clicked that button 13 times, not 10, and the text in the
child went from 0 to 13. The value changed on the page without the component
functions running again.

## What this does not show

Part A is one tiny page with one library, built once. Another library would give
another number, and I only counted the files in the script tags. I did not measure
load time, hydration time or memory. Part B used Preact with `@preact/signals`, so it
says nothing about React with `@preact/signals-react`, or about signals in other
frameworks. Render counts show how often a function runs, not which parts of the page
changed. I also did not record what the browser console showed for the Part A pages.

## What's next

Day 29 is WebAssembly: Rust compiled to a module that JavaScript calls, with timings
for three input sizes. Full code in the [repo](#) — `day-28-rsc-signals/`.
