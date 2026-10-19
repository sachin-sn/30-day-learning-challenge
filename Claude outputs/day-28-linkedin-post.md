Day 28 of the 30-day challenge: React Server Components and signals. I use React every day, but I had not measured either idea, so I built two small apps and counted.

Part A is a Next.js page that turns markdown into HTML in a Server Component, next to the same page doing it in a Client Component. I guessed the server page would send more JavaScript, by about 200 kB. It was the other way round: 555.4 kB for the server page against 600.3 kB for the client page, so 44.9 kB less. In the page source the whole difference was one extra script file on the client page. Both pages already had the finished text in the HTML.

Part B counts how often component functions run in Preact, with useState and with signals, after clicking each button. I guessed 10 for every function. The useState parent and child ran 11 times each, the first render plus 10 clicks. The two signal components ran once. I clicked that button 13 times, the text in the child went from 0 to 13, and the functions did not run again.

What I did not test: another library, load or hydration time, memory, React with the signals package for React, or other frameworks. It was one build and one run, and I did not record the browser console for the Part A pages. The starter code was written by Claude, and I read it, ran it and measured. Full writeup on the blog: <link>

#30DayChallenge #ReactServerComponents #Signals #NextJS #Preact #SoftwareEngineering
