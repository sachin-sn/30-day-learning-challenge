Day 13 of the 30-day challenge: distributed locks with Redis. I built one, then spent the day breaking it on purpose to see exactly where "lock" stops meaning "safe."

First the baseline: 5 workers, 20 increments each, one shared counter. With a Redis lock around the read-modify-write, the final value was exactly 100. Without it: 23. 77 of 100 updates lost, because all five workers read the same number before anyone wrote back, so each round of five increments only moved the counter by about one.

Then the part that actually changed how I think about locks. A lock with an expiry doesn't guarantee exclusion; it guarantees the lock goes away. I had one worker take a 1-second lock and stall for 2 seconds inside it. A second worker picked up the lock at about 1 second, and for roughly 967 milliseconds two workers were inside a section that was supposed to hold one — with no error anywhere. Redis did exactly what it was told.

It got worse with a lazy release. If the stalled worker releases with a plain delete instead of checking that it still owns the lock, it deletes the new owner's lock, and a third worker walks in while the second is still working. The fix is one comparison inside a Lua script.

What a lock can't fix at all is the stalled worker's late write. That's what fencing tokens are for: every acquire returns an ever-increasing number, and the resource itself rejects any write carrying a lower one. Same stall, same timeline — without fencing the stale worker overwrote newer data; with it, the write was refused.

Last piece was Redlock: five independent Redis instances, majority of three. Three up still locked; two up failed closed, exactly as it should. And since two clients can't both collect three of five votes, they can't both hold the lock.

Full writeup and real terminal output on the blog: <link>

#30DayChallenge #Redis #DistributedSystems #Redlock #TypeScript #NodeJS #SoftwareEngineering
