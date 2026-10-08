Day 16 of the 30-day challenge: deploying to the edge with Cloudflare Workers. I built one Worker and tested it from my Mac and from Google Cloud Shell. From the Mac it ran in Chennai, from Cloud Shell in Singapore, with no setting changed. There is no region to pick.

The part that surprised me was the timing. Over 24 curl calls from my Mac, the best total was 51 to 55 ms, and the slowest was over 280 ms. From Cloud Shell, 2 ms from the edge, the best total was still 53 ms, and the TLS step alone took about 38 ms while TCP took 2 ms. I do not know why. Both clients are different machines, so I call it a hint, not a result.

Caching went differently from my predictions. I guessed 50 ms for a miss, 100 ms for a hit, and a timeout after the 30-second limit. The origin waits two seconds, so a miss cannot take 50 ms. Hits took about 30 ms, and after 30 seconds the next caller just paid the full 2.1 seconds again. One cache option I used did nothing at all, and I do not know why.

The result I will remember is the counter. I sent 50 increments at the same time to a counter in Workers KV and to one in a Durable Object. KV ended at 1: 48 requests all read 0 and all wrote 1. The Durable Object ended at 50 with every value from 1 to 50 appearing once. It is the lost update from Day 13 again, this time at the edge. I ran each only once, so the timings are one sample.

I also checked a signed request at the edge. Requests with a wrong signature or an old timestamp got a 401 in about 23 ms and, according to the origin's log, never reached the origin.

Full writeup, including what I did not measure, on the blog: <link>

#30DayChallenge #CloudflareWorkers #EdgeComputing #Serverless #TypeScript #SoftwareEngineering
