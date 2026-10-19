# Day 28 — React Server Components & Signals

## Predictions (written before running anything)

1. Which page sends more JavaScript, `/server` or `/client`, and by about how many kB: "server, 200kb"
2. How many times each function runs after 10 clicks on the useState button and 10 on the signal button (StateParent, StateChild, SignalParent, SignalChild): "10 times" (one number for all four, no separate numbers)

## Output

### Part A: `node measure.js` (Next.js 16.4.2, production build, `npm start`)

```
/        scripts:  8   raw:   563.0 kB   gzip:  174.1 kB   html: 5.1 kB   text "same markdown" in the HTML: no
/server  scripts:  7   raw:   555.4 kB   gzip:  170.9 kB   html: 5.8 kB   text "same markdown" in the HTML: yes
/client  scripts:  8   raw:   600.3 kB   gzip:  184.5 kB   html: 5.4 kB   text "same markdown" in the HTML: yes
```

- `/client` sent more JavaScript than `/server`: 44.9 kB more raw (600.3 against 555.4) and 13.6 kB more gzip (184.5 against 170.9). So my prediction ("server, 200kb") was wrong: the server page sent less, and the difference was about 45 kB, not 200.
- The text "same markdown" is already in the HTML of both pages, so the client page also renders its text on the server.
- Terminal of `npm start` (the part I pasted): "[server] /server page rendered on the server" appeared 9 times, and "[client or server?] Markdown component function ran" appeared 5 times. Both kinds of lines are in the terminal of the server process.
- Page source of both pages (pasted): both already contain the finished HTML (`<h1>Day 28</h1>`, the list and the quote). The list of script files is the same for both pages except one extra file on `/client`: `/_next/static/chunks/0bc6gb6lxytnf.js`. The other files have the same names, so the 44.9 kB (raw) difference is that one file.
- In the `/server` page source, the finished markdown HTML also appears a second time inside the `self.__next_f.push(...)` data, as a string in `dangerouslySetInnerHTML`. In the `/client` page source that string is not there; there is a reference to the client component instead (a chunk with the `0bc6...` file).
- Browser console: TODO (I pasted two lines, "/ server" and "/ client", with no console output; write what the console showed, or "nothing").

### Part B: render counts (Preact, `npm run dev`)

Page after my clicks: the useState section showed "child shows: 10" and the signals section showed "child shows: 13" (so I clicked the signal button 13 times, not 10). Table copied from the page at that point:

```
component     times its function ran
StateParent   11
StateChild    11
SignalParent  1
SignalChild   1
```

- The useState components ran 11 times each, which is 1 first render plus 10 clicks. My prediction of "10 times" for all four was off by one for the useState pair (it did not count the first render) and wrong for the signal pair (they ran 1 time each).
- The signal components ran only for the first render, 1 time each, even after 13 clicks, while the text in the child went from 0 to 13. The value changed on the page without the component functions running again.

## What I learned (3 sentences)

TODO

## Not measured / still open

- Part A is one tiny page with one library (`marked`) in a production build of Next.js 16.4.2, measured once. The 44.9 kB difference is for this library; another library would give another number. Only the files listed in the page's script tags were counted, not files loaded later.
- Part A measures sent JavaScript, not speed. Load time, hydration time and memory: not measured.
- Part B uses Preact with `@preact/signals`, not React and not Next.js, so the render counts say nothing about `@preact/signals-react` or about signals in other frameworks. The signal button was clicked 13 times and the useState button 10 times.
- Render counts count how often a component function runs, not DOM updates or time. I did not check which DOM nodes changed.
- Browser console of the two Part A pages: not recorded (TODO above).

## Link

TODO: docs link with one sentence
