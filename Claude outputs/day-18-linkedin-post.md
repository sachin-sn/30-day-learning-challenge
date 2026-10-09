Day 18 of the 30-day challenge: observability with OpenTelemetry. I added the Node SDK to a small Express server and printed every span to the console, with no collector and no UI. From today the challenges are shorter, about 90 minutes each.

Before writing code I made two guesses. One request would print 5 spans, and a function that waits about 200 ms would be 20% of the request time. Each request printed 5 spans, but that included my own span, which I had not counted when I guessed. The 20% was far off. Over five requests the slow function was between 95% and 100% of the request time, and everything else took 0.8 to 9.8 ms.

What I liked is how little work it took to get a tree. I did not pass any context to my own span, and it still showed up as a child of the Express handler span, under the HTTP span.

The failing route showed a difference I did not expect. I caught an error in my own span and recorded it. That span has the error status, the message and a stack trace pointing at the throw. The automatic HTTP span for the same request also has the error status, from the 500, but no message and no events. So the reason for the failure is only there because I recorded it. I did not test the version without my own code, so that part is my reading of the two spans.

I ran five requests and one failing request, so there is no spread to talk about, and I did not look into why the first request had the largest extra time. Full writeup on the blog: <link>

#30DayChallenge #OpenTelemetry #Observability #NodeJS #TypeScript #SoftwareEngineering
