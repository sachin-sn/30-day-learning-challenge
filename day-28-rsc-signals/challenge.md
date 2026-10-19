# Day 28 — React Server Components & Signals

Short format (about 90 minutes). Two small apps, two measurements:
(A) how much JavaScript a page ships when work runs in a Server Component or in a Client Component,
(B) how many times components run when state changes with `useState` or with signals.

## Predictions (5 min) — write them in `solution.md` BEFORE running anything

1. Part A: the page `/server` and the page `/client` show the same text. Which one sends more JavaScript to the browser, and by about how many kB (a number)?
2. Part B: you click the `useState` button 10 times, then the signal button 10 times. How many times does each component function run in total (a number for each of StateParent, StateChild, SignalParent, SignalChild)?

## Part A: Server vs Client Component (about 40 min) — folder `src/rsc`

1. `cd src/rsc && npm install`
2. Read `app/server/page.jsx`, `app/client/page.jsx`, `app/client/Markdown.jsx`. The only difference is where `renderMarkdown()` runs (the line `"use client"` decides).
3. `npm run build && npm start`
4. In a second terminal, in the same folder: `node measure.js`. It adds up the JavaScript files each page loads (raw and gzip) and checks if the text is already in the HTML.
5. Open `http://localhost:3000/server` and reload it a few times. Look at the terminal where `npm start` runs: which lines appear? Also open `/client` and look at the browser console.
6. In the browser, "View page source" for both pages.

## Part B: useState vs signals (about 30 min) — folder `src/signals`

1. `cd src/signals && npm install && npm run dev`, open the address it prints.
2. Read `main.jsx`: `bump(name)` counts each time a component function runs. The table at the bottom shows the counters.
3. Click `+1 (useState)` 10 times, write down the table. Then click `+1 (signal)` 10 times, write down the table again.

## Save in `solution.md`

- The output of `node measure.js` and which page sent more JavaScript.
- What you saw in the terminal and the browser console in step 5, and whether the text was in the page source of both pages.
- The render-count table after the useState clicks and after the signal clicks.

## Not today

Caching, streaming, Server Actions, the `use` hook, `@preact/signals-react`, other frameworks' signals, performance timings, fixing sizes by tuning the bundle.
