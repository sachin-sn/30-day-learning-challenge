# Day 16 — Solution: Deploying to the Edge

## Setup

```
cd src
npx wrangler dev --port 8787     # then: curl -s localhost:8787/where
npx wrangler deploy              # https://day16-edge.day15-hash.workers.dev
```

`wrangler.toml`: `name = "day16-edge"`, `main = "index.ts"`,
`compatibility_date = "2025-01-01"`. Types come from `wrangler types`
(`worker-configuration.d.ts`).

## Approach

One Worker, `src/index.ts`. Part 1 has one route, `GET /where`, which returns
JSON from `request.cf`, not from `request`: `colo`, `country`, `httpProtocol`,
`tlsVersion` and `clientTcpRtt`. It also sends an `x-colo` header and answers
`HEAD` as well as `GET` (both added after an online testing tool got a 404, see
below). Anything else returns a 404 with `{"error":"Not Found"}`.

## Part 1 — where does it run, and where does the time go

### Predictions (written before running anything)

| Question                          | My prediction              | Result                                               | Held?           |
| --------------------------------- | -------------------------- | ---------------------------------------------------- | --------------- |
| Local `colo`                      | India, `COLO` not known    | `MAA`, `IN`                                          | yes for country |
| Local connect and start transfer  | under about 1 ms           | connect 3.2 ms, start transfer 11.0 ms (one request) | no              |
| Deployed `colo`                   | US, `COLO` not known       | `MAA`, `IN`                                          | no              |
| Deployed connect / start transfer | about 165 ms / about 50 ms | one request: 29.1 ms / 82.7 ms                       | no              |

TODO: your own words on why the US guess was wrong. (Facts: Lambda was in
us-east-1 and Cloud Run in asia-south1, because I chose those regions. A Worker has no
region setting.) Note also that `time_starttransfer` is counted from the start of
the request, so it includes the connect time and cannot be smaller than it.

### Local: `wrangler dev`

```
{"colo":"MAA","country":"IN","httpProtocol":"HTTP/1.1","tlsVersion":"TLSv1.3"}
namelookup: 0.000018   connect: 0.003217   appconnect: 0.000000
starttransfer: 0.010968   total: 0.010985
```

`appconnect` is 0, so the local request had no TLS, yet the JSON says
`TLSv1.3`. The file `src/.wrangler/cache/cf.json` holds the same `colo`,
`country`, `httpProtocol` and `tlsVersion` values. So in `wrangler dev`,
`request.cf` looks like a stored copy of what Cloudflare saw earlier, and does
not describe the local connection. This is my reading of the cache file. TODO:
confirm in the Wrangler or `request.cf` docs, and link the page.

### Deployed Worker, first single request

```
{"colo":"MAA","country":"IN","httpProtocol":"HTTP/2","tlsVersion":"TLSv1.3"}
namelookup: 0.003044   connect: 0.029116   appconnect: 0.055029
starttransfer: 0.082729   total: 0.082776
```

### Timing in parts, from my Mac (12 + 12 separate curl calls)

Command (each call opens a new connection):

```
for i in $(seq 12); do curl -s -o /dev/null -w "dns %{time_namelookup} connect %{time_connect} tls %{time_appconnect} ttfb %{time_starttransfer} total %{time_total}\n" https://day16-edge.day15-hash.workers.dev/where; done
```

curl prints cumulative times. The steps below are the differences: TCP =
connect − dns, TLS = tls − connect, wait = ttfb − tls.

Batch 1, in ms (fastest / median / slowest):

| Step                | Fastest | Median | Slowest |
| ------------------- | ------- | ------ | ------- |
| DNS                 | 2.4     | 3.0    | 5.2     |
| TCP                 | 8.8     | 12.4   | 43.0    |
| TLS                 | 18.7    | 23.8   | 146.7   |
| Wait for first byte | 20.0    | 61.2   | 175.7   |
| Total               | 51.2    | 122.8  | 315.5   |

Batch 2 (after a redeploy):

| Step                | Fastest | Median | Slowest |
| ------------------- | ------- | ------ | ------- |
| DNS                 | 2.5     | 3.3    | 5.3     |
| TCP                 | 9.0     | 40.0   | 112.7   |
| TLS                 | 18.3    | 22.8   | 152.1   |
| Wait for first byte | 18.3    | 24.3   | 125.2   |
| Total               | 55.3    | 90.2   | 281.2   |

Raw lines:

```
# batch 1
dns 0.003914 connect 0.016430 tls 0.042469 ttfb 0.104256 total 0.104349
dns 0.002884 connect 0.044904 tls 0.139017 ttfb 0.314693 total 0.315474
dns 0.003876 connect 0.016223 tls 0.041191 ttfb 0.061717 total 0.061837
dns 0.002418 connect 0.014414 tls 0.045548 ttfb 0.120528 total 0.120701
dns 0.004552 connect 0.047581 tls 0.194299 ttfb 0.254851 total 0.255088
dns 0.005226 connect 0.026815 tls 0.120603 ttfb 0.147440 total 0.147557
dns 0.003025 connect 0.017815 tls 0.040247 ttfb 0.163898 total 0.164062
dns 0.003143 connect 0.012390 tls 0.031163 ttfb 0.051793 total 0.051939
dns 0.002861 connect 0.017530 tls 0.039297 ttfb 0.124609 total 0.124812
dns 0.002828 connect 0.011657 tls 0.030396 ttfb 0.051033 total 0.051170
dns 0.003029 connect 0.014419 tls 0.033596 ttfb 0.053572 total 0.053703
dns 0.002975 connect 0.014663 tls 0.037343 ttfb 0.160203 total 0.160471
# batch 2
dns 0.003341 connect 0.012641 tls 0.030916 ttfb 0.156077 total 0.156171
dns 0.003551 connect 0.105638 tls 0.257704 ttfb 0.281018 total 0.281222
dns 0.005304 connect 0.019955 tls 0.045357 ttfb 0.076299 total 0.076382
dns 0.002482 connect 0.053488 tls 0.075926 ttfb 0.097421 total 0.097498
dns 0.002605 connect 0.040523 tls 0.060278 ttfb 0.082095 total 0.082250
dns 0.003370 connect 0.045459 tls 0.064553 ttfb 0.082829 total 0.082942
dns 0.002869 connect 0.048113 tls 0.130063 ttfb 0.156786 total 0.157237
dns 0.003269 connect 0.012316 tls 0.033216 ttfb 0.052865 total 0.055288
dns 0.003501 connect 0.016528 tls 0.037607 ttfb 0.061163 total 0.061265
dns 0.002494 connect 0.115220 tls 0.144224 ttfb 0.175323 total 0.175459
dns 0.004238 connect 0.096981 tls 0.134827 ttfb 0.162052 total 0.162302
dns 0.002859 connect 0.014689 tls 0.037796 ttfb 0.062805 total 0.062933
```

What the 24 runs show:

- The best total is stable: 51.2 ms in batch 1 and 55.3 ms in batch 2.
- The median and the slowest runs are much higher (median 123 and 90 ms; slowest
  315 and 281 ms).
- The slow step is not always the same one. In batch 1 the wait varied most. In
  batch 2 the wait median was 24 ms, and the slow runs were slow in TCP (102,
  113, 93 ms) and TLS (152 ms). The TCP handshake finishes at the Cloudflare edge
  before any Worker code runs, so a TCP step of 113 ms does not come from my code.
- TCP plus TLS (connection setup) was about half of the total in batch 1 (median
  share 49%) and about three quarters in batch 2 (72%).
- Day 15 said the slow first request was connection setup. Here the connection
  is part of the answer, not all of it, and the amount depends on the batch.

### Network only, from my Mac: `ping -c 20`

```
round-trip min/avg/max/stddev = 14.452/53.261/202.948/44.815 ms   (0.0% loss)
```

Median of the 20 pings: about 46 ms. The spread is large, like the spread in the
curl runs. Ping is a different measurement from TCP connect (ping min 14.5 ms, TCP
min 9.0 ms), so the two do not match exactly.

### A second location: Google Cloud Shell (Singapore edge)

```
{"colo":"SIN","country":"SG","httpProtocol":"HTTP/2","tlsVersion":"TLSv1.3","clientTcpRtt":1}
dns 0.001504 connect 0.039664 tls 0.089620 ttfb 0.154637 total 0.154699
dns 0.001412 connect 0.003713 tls 0.044504 ttfb 0.057912 total 0.057972
dns 0.001263 connect 0.003261 tls 0.041396 ttfb 0.061501 total 0.061626
dns 0.001390 connect 0.003593 tls 0.044234 ttfb 0.067114 total 0.067176
dns 0.001365 connect 0.036398 tls 0.083823 ttfb 0.144455 total 0.144518
dns 0.001481 connect 0.003405 tls 0.041610 ttfb 0.053118 total 0.053178
dns 0.001392 connect 0.042487 tls 0.115186 ttfb 0.285213 total 0.285348
dns 0.001441 connect 0.037250 tls 0.085662 ttfb 0.134292 total 0.134356
dns 0.001347 connect 0.004036 tls 0.042006 ttfb 0.054525 total 0.054586
dns 0.001322 connect 0.003669 tls 0.042172 ttfb 0.093669 total 0.094034
dns 0.001494 connect 0.003325 tls 0.041658 ttfb 0.055553 total 0.055614
dns 0.001218 connect 0.003025 tls 0.041358 ttfb 0.056246 total 0.056334
```

In ms (fastest / median / slowest):

| Step                | Fastest | Median | Slowest |
| ------------------- | ------- | ------ | ------- |
| DNS                 | 1.2     | 1.4    | 1.5     |
| TCP                 | 1.8     | 2.3    | 41.1    |
| TLS                 | 38.0    | 39.6   | 72.7    |
| Wait for first byte | 11.5    | 21.5   | 170.0   |
| Total               | 53.2    | 64.4   | 285.3   |

- The same Worker, with no setting changed, ran in `MAA` for my Mac and in `SIN`
  for Cloud Shell.
- `clientTcpRtt` was 1 (the unit is in the `request.cf` docs, TODO: confirm). TCP
  connect in 8 of 12 runs was 1.8 to 2.7 ms, which fits a client right next to the
  edge.
- In 4 of 12 runs (1, 5, 7, 8) TCP took 35 to 41 ms, and those runs also had the
  slowest TLS and wait. I did not find out why. The next step would be to print
  `%{remote_ip}` and the `cf-ray` header for each run.
- TLS took 38 to 41 ms in the fast runs too, even though TCP took about 2 ms. A
  TLS 1.3 handshake needs about one round trip, so the network cannot explain
  38 ms here. Cause not known; it could be work on the client side (Cloud Shell
  and curl) or on the server side. I did not measure which.
- The best total from Singapore (53.2 ms, 2 ms away from the edge) is about the
  same as the best total from my Mac (51.2 and 55.3 ms, about 14 ms away). So
  being closer did not lower the best case. The two clients are different
  machines, so this is not a clean comparison.

### An online multi-location test tool (not used)

I tried an online tool that tests from eight locations. Every row came back with
status 404, and I did not have its column names, so I cannot read its numbers.
The 404 was probably a `HEAD` request or a URL without `/where`, because my first
version answered only `GET /where`. I did not confirm which. I changed the Worker
to answer `HEAD` and to send `x-colo`. TODO: say whether the tool worked after the
fix, or drop this section.

### Still to do for Part 1

- TODO: the reuse test (the same URL twice in one curl call, a few times), to show
  the cost of a request once the connection exists.
- TODO: `clientTcpRtt` from the Mac, if the deployed version has it.
- TODO: one or two sentences in your own words on what Part 1 changed in what you
  believed after Day 15.

## Part 2 — cache at the edge

### Predictions (written before running anything)

| Question                                       | My prediction           | Result                                                                                                                                     | Held? |
| ---------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| How long does a miss take?                     | about 50 ms             | 2431.6 ms (first run), 2190.7 ms, 2105.0 ms at the client; 2008 to 2057 ms inside the Worker                                               | no    |
| How long does a hit take?                      | about 100 ms            | 27.4 to 154.9 ms at the client, median 30.2 ms on a reused connection; 166.6 and 190.3 ms after a 12 s pause; 4 to 16 ms inside the Worker | no    |
| What happens after the 30-second time to live? | a timeout occurs        | no error. The next call was a MISS with a new `at` and took 2105.0 ms (it called the origin again)                                         | no    |
| Does a second location see a hit?              | TODO: not predicted yet | Cloud Shell (`SIN`) had its own MISS then 2 HITs, but the `MAA` copy had already expired, so not tested yet                                | open  |

### What was built

- `src/origin/index.ts`: a second Worker, `day16-origin`. `GET /` waits 2 seconds
  and returns `{ origin, hits, waitedMs, at }`. `at` is the time the answer was
  made. A cached copy keeps the same `at`, so `at` shows whether a response came
  from the origin or from a cache. `hits` counts per instance, not globally.
- `src/index.ts`, two routes, both with a time to live of 30 seconds:
  - `GET /slow-cacheapi`: version A, `caches.default` (Cache API). It stores the
    answer with `cache.put` and sets `x-cache` to `HIT` or `MISS`.
  - `GET /slow`: version B, `fetch(ORIGIN_URL, { cf: { cacheEverything: true,
cacheTtl: 30 } })`. `x-cache` is Cloudflare's `cf-cache-status` header.
- Response headers on both: `x-cache`, `x-age-s`, `x-edge-ms` (time spent in the
  Worker), `x-colo`.
- `src/wrangler.toml`: `ORIGIN_URL` in `[vars]`, and the compatibility flag
  `global_fetch_strictly_public`. The flag is there because the edge Worker calls
  another Worker on the same account over `workers.dev`. The docs I read say
  Worker-to-Worker calls need either a service binding or this flag. I chose the
  flag so `fetch` goes through the normal cache path. I have not tested that.
- `src/slow-test.ts`: calls a URL N times in a row and prints status, time, cache
  headers and `at`.
- Checked so far: both Workers pass `tsc --strict` and bundle with
  `wrangler deploy --dry-run`. Nothing has been deployed or run yet.

TODO: read the docs for the Cache API and for `fetch` `cf` options. Write down
what they say about where the Cache API works, and link the pages with the date
you read them. (Pages: https://developers.cloudflare.com/workers/runtime-apis/cache/
and https://developers.cloudflare.com/workers/examples/cache-using-fetch/.)

### Run

Origin alone (`curl -s -w ' %{time_total}s\n' https://day16-origin.day15-hash.workers.dev/`):

```
{"origin":"day16-origin","hits":1,"waitedMs":2000,"at":"2026-10-07T16:33:33.455Z"} 2.386954s
```

`/slow-cacheapi`, 10 calls in a row from my Mac (`npx tsx slow-test.ts <url>/slow-cacheapi 10`):

```
 1  200   2431.6 ms  x-cache=MISS  age=0  edge=2057ms  colo=MAA  at=2026-10-07T16:35:29.967Z
 2  200     37.0 ms  x-cache=HIT  age=0  edge=9ms  colo=MAA  at=2026-10-07T16:35:29.967Z
 3  200     30.0 ms  x-cache=HIT  age=0  edge=6ms  colo=MAA  at=2026-10-07T16:35:29.967Z
 4  200     30.2 ms  x-cache=HIT  age=0  edge=6ms  colo=MAA  at=2026-10-07T16:35:29.967Z
 5  200     83.1 ms  x-cache=HIT  age=0  edge=16ms  colo=MAA  at=2026-10-07T16:35:29.967Z
 6  200     27.4 ms  x-cache=HIT  age=0  edge=5ms  colo=MAA  at=2026-10-07T16:35:29.967Z
 7  200     28.1 ms  x-cache=HIT  age=0  edge=5ms  colo=MAA  at=2026-10-07T16:35:29.967Z
 8  200     27.6 ms  x-cache=HIT  age=0  edge=6ms  colo=MAA  at=2026-10-07T16:35:29.967Z
 9  200     39.0 ms  x-cache=HIT  age=0  edge=5ms  colo=MAA  at=2026-10-07T16:35:29.967Z
10  200    154.9 ms  x-cache=HIT  age=0  edge=6ms  colo=MAA  at=2026-10-07T16:35:29.967Z
```

- The miss took 2431.6 ms at the client. Of that, 2057 ms was inside the Worker
  (`edge`), which includes the origin's 2000 ms wait. The other 375 ms was outside
  the Worker: part of it is the first connection from my Mac, but I did not time
  the parts separately.
- The 9 hits took 27.4 to 154.9 ms at the client, median 30.2 ms, and 5 to 16 ms
  inside the Worker. The hits come after the first connection, which Node's
  `fetch` reuses.
- All 10 answers have the same `at`, so only one answer came from the origin and
  the other nine are the stored copy.
- `age` stayed 0 because all 10 calls took less than 1 second in total.
- The Cache API did store and return a response on the `workers.dev` URL, from
  `MAA`. The Cache API docs page (read 2026-10-07,
  https://developers.cloudflare.com/workers/runtime-apis/cache/) says: "Workers
  deployed to custom domains have access to functional `cache` operations." It does
  not say that `workers.dev` fails. So the sentence says where it is guaranteed to
  work, and my run shows it also worked on `workers.dev`. (I first understood the
  page to say that `workers.dev` does not work. That was a summary, not the
  sentence, and it was wrong.) The same page says: "The Cache API is available
  globally but the contents of the cache do not replicate outside of the originating
  data center."

`/slow` (version B, `fetch` with `cf: { cacheEverything: true, cacheTtl: 30 }`), 10 calls in a row:

```
 1  200   2247.0 ms  x-cache=none  age=none  edge=2038ms  colo=MAA  at=2026-10-07T16:37:38.019Z
 2  200   2124.5 ms  x-cache=none  age=none  edge=2007ms  colo=MAA  at=2026-10-07T16:37:40.074Z
 3  200   2037.7 ms  x-cache=none  age=none  edge=2006ms  colo=MAA  at=2026-10-07T16:37:42.199Z
 4  200   2095.0 ms  x-cache=none  age=none  edge=2005ms  colo=MAA  at=2026-10-07T16:37:44.238Z
 5  200   2038.7 ms  x-cache=none  age=none  edge=2005ms  colo=MAA  at=2026-10-07T16:37:46.332Z
 6  200   2051.7 ms  x-cache=none  age=none  edge=2006ms  colo=MAA  at=2026-10-07T16:37:48.374Z
 7  200   2038.4 ms  x-cache=none  age=none  edge=2006ms  colo=MAA  at=2026-10-07T16:37:50.423Z
 8  200   2061.4 ms  x-cache=none  age=none  edge=2005ms  colo=MAA  at=2026-10-07T16:37:52.490Z
 9  200   2063.8 ms  x-cache=none  age=none  edge=2006ms  colo=MAA  at=2026-10-07T16:37:54.553Z
10  200   2060.3 ms  x-cache=none  age=none  edge=2005ms  colo=MAA  at=2026-10-07T16:37:56.587Z
```

- `/slow` did not cache. All 10 calls took about 2 seconds (median 2060.9 ms at
  the client, 2005 to 2038 ms inside the Worker), and every call has a new `at`, so
  every call reached the origin.
- `x-cache=none` and `age=none` mean the response had no `cf-cache-status` and no
  `age` header, so Cloudflare did not report a cache decision at all (a `MISS` or
  `DYNAMIC` would have been printed). I do not know why. Candidates, none tested:
  the origin is another Worker on `workers.dev`; `cacheEverything` and `cacheTtl`
  are not applied to a subrequest to a Worker; the flag
  `global_fetch_strictly_public` changes the path. TODO: read the `cf` options page
  and say which, or say that it is still unknown.

TTL test on `/slow-cacheapi` (4 calls, 12 s apart, after waiting about 40 s so the
old entry had expired):

```
 1  200   2190.7 ms  x-cache=MISS  age=0   edge=2011ms  colo=MAA  at=2026-10-07T16:38:14.849Z
 2  200    166.6 ms  x-cache=HIT   age=12  edge=7ms     colo=MAA  at=2026-10-07T16:38:14.849Z
 3  200    190.3 ms  x-cache=HIT   age=24  edge=4ms     colo=MAA  at=2026-10-07T16:38:14.849Z
 4  200   2105.0 ms  x-cache=MISS  age=0   edge=2008ms  colo=MAA  at=2026-10-07T16:38:53.335Z
```

- The entry was a HIT at 12 s and 24 s. At call 4, about 36 s after it was stored
  (the `at` values are 38.5 s apart), it was a MISS with a new `at`. So the 30-second
  time to live was applied. I did not find the exact second it expired, because I
  only sampled at 12, 24 and 36 s.
- Nothing timed out. The cost of expiry was that one unlucky caller waited about
  2.1 seconds, and everyone after that got a hit again.
- Calls 2 and 3 took 166.6 and 190.3 ms at the client but only 7 and 4 ms inside
  the Worker. The difference, about 160 to 185 ms, is outside the Worker. In the
  first run, hits took about 30 ms. The difference between the runs is the 12 s
  pause. I think the pause closed the connection, so each hit paid for a new
  connection, like in Part 1. I did not check this.

Three `curl` calls to `/slow-cacheapi` from my Mac (headers, then time):

```
x-age-s: 25   x-cache: HIT   x-cached-at: 1791391133336   x-colo: MAA   time 0.112271
x-age-s: 26   x-cache: HIT   x-cached-at: 1791391133336   x-colo: MAA   time 0.210165
x-age-s: 26   x-cache: HIT   x-cached-at: 1791391133336   x-colo: MAA   time 0.080534
```

- `x-cached-at` 1791391133336 is 2026-10-07 16:38:53.336 UTC, the time the entry from
  call 4 above was stored. The three curl calls came 25 to 26 seconds later and
  were still HITs, as expected inside 30 seconds.
- Each `curl` opens a new connection, and took 80 to 210 ms at the client against
  a few ms inside the Worker.
- This was from my Mac, not from a second location.

Three `curl` calls to `/slow-cacheapi` from Google Cloud Shell (colo `SIN`):

```
x-age-s: 0   x-cache: MISS   x-cached-at: 1791391335304   x-colo: SIN   time 2.140137
x-age-s: 0   x-cache: HIT    x-cached-at: 1791391335304   x-colo: SIN   time 0.062983
x-age-s: 0   x-cache: HIT    x-cached-at: 1791391335304   x-colo: SIN   time 0.074860
```

- `SIN` had its own MISS, then two HITs. The first call took 2140 ms (the origin
  wait), and the HITs took 63 and 75 ms, each with a new connection.
- This does not answer "does a second location see a hit?". `x-cached-at`
  1791391335304 is 2026-10-07 16:42:15.304 UTC. The entry made at `MAA` was stored
  at 16:38:53.336 UTC, about 202 seconds earlier, so it had already expired
  (30-second limit). A MISS at `SIN` was the expected result either way.
- A proper test: call from the Mac (`MAA`), and within 30 seconds call from Cloud
  Shell (`SIN`). A MISS at `SIN` would show that the Cache API copy belongs to one
  data center. The docs say the Cache API is per data center; that is not
  yet seen in my own run.

### Still to do for Part 2

- TODO: prediction, then the proper two-location run (Mac first, then Cloud Shell
  within 30 seconds): does it see a HIT, or its own MISS? The docs sentence above
  says the copy stays in the data center where it was made.
- TODO: the `fetch` `cf` options docs
  (https://developers.cloudflare.com/workers/examples/cache-using-fetch/, read
  2026-10-07). That page shows `cacheEverything` and `cacheTtl`, and says
  `cf-cache-status` reports HIT or MISS. It did not explain why my call showed no
  `cf-cache-status`. Which approach I used in the end: the Cache API (`/slow-cacheapi`).
- TODO: one paragraph in my words on why a cache at the edge has a different hit
  rate from a cache in front of one server.

## Part 3 — state at the edge: counting

### Predictions

None were written before the runs, so there is no prediction table for this part. The results are below.

### What was built

- `POST /count/kv`: reads the value from Workers KV, adds 1, writes it back. Not
  atomic.
- `POST /count/do`: calls a SQLite-backed Durable Object (`Counter`, one object
  named `global`). Inside the object the update is one SQL statement, so two
  requests cannot interleave between read and write.
- `GET /count/<kv|do>` reads the value, `POST /count/<kv|do>/reset` sets it to 0.
- `src/load.ts <base-url> <kv|do> [n=50]`: resets the counter, sends n requests at
  the same time, waits, reads the final value, and prints successes, failures,
  distinct values returned, and the final value.
- `wrangler.toml`: KV binding `COUNTER_KV` (needs the namespace id), Durable
  Object binding `COUNTER_DO`, and `[exports.Counter]` with `storage = "sqlite"`,
  which is the form the Durable Objects docs show today (read 2026-10-07).
- Checked so far: `tsc --strict` and `wrangler deploy --dry-run` pass. Nothing has
  been run.

Limits read from the docs on 2026-10-07 (TODO: re-read, add links):
KV Free plan: 1,000 writes per day to different keys, 1 write per second to the
same key, 100,000 reads per day. Durable Objects Free plan: SQLite-backed only,
100,000 requests per day, 100,000 SQLite rows written per day. One test run of 50
increments uses about 50 KV writes (the limit is per day, so keep runs within it).

### Run

One run for each store (the challenge asks for three each; runs 2 and 3 were not
done):

```
store=kv  sent=50  ok=48  failed=2  took=2106 ms
final value read afterwards: 1   (a correct counter ends at 50)
values returned: 1 distinct, min=1, max=1
sorted values: 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1
failure x2: 500 Error: KV PUT failed: 429 Too Many Requests

store=do  sent=50  ok=50  failed=0  took=352 ms
final value read afterwards: 50   (a correct counter ends at 50)
values returned: 50 distinct, min=1, max=50
sorted values: 1 2 3 4 5 6 7 8 9 10 ... 50
```

- **KV:** 48 requests succeeded and every one of them returned `1`. All 48 read the
  value `0` before any write landed, each added 1, and each wrote `1`. The final
  value was `1`, not 50, so 47 increments were lost. Two requests failed with
  `KV PUT failed: 429 Too Many Requests`.
- **Durable Object:** all 50 succeeded, the values 1 to 50 each appeared once, and
  the final value was 50.
- The whole batch took 2106 ms for KV and 352 ms for the Durable Object. I did not
  look into why KV was slower, and one run each is not enough to compare.
- This is the lost-update problem from Day 13 (read, add, write without a lock).
  It is also the Day 12 problem: a rate-limit counter that is not atomic lets
  through more requests than the limit.
- The KV docs I read on 2026-10-07 say one write per second to the same key. Here
  48 of 50 writes to the same key within a couple of seconds were accepted and 2
  were refused with 429, so the limit did not refuse all of them. I do not know why.
- KV writes used so far today: about 52 of the 1,000 free writes (50 increments, a
  reset, and later resets). TODO: confirm in the dashboard.
- Not done: waiting 60 seconds and reading the KV counter from another location
  (Cloud Shell, `GET /count/kv`), which the challenge asks for.

## Part 4 — check a signed request at the edge

### Predictions

None were written before the runs, so there is no prediction table for this part. The results are below.

### What was built

- `POST /orders` in `src/index.ts`. The caller sends `x-timestamp` (Unix seconds)
  and `x-signature` (hex HMAC-SHA256 of `"<timestamp>.<body>"`). The Worker returns
  401 for: a missing header, a timestamp more than 300 seconds from now, a
  signature that is not 64 hex characters, and a signature that does not match.
  The reason goes to `console.log` (visible with `wrangler tail`), not to the
  caller. The 401 body is always `{"error":"unauthorized"}`.
- The signature is compared with `crypto.subtle.timingSafeEqual`, a Workers
  extension to Web Crypto that the docs describe as resistant to timing attacks.
  Both buffers are 32 bytes before the call. Only `crypto.subtle` is used.
- A valid request is passed to the origin Worker's `POST /orders`, which answers
  at once and counts calls in `orderHits` (per instance, so it is a count for one
  instance, as on Day 15). `GET /orders-count` on the origin shows it.
- The secret is `ORDERS_SECRET`: in `src/.dev.vars` for `wrangler dev` and the test
  script (the file is in `.gitignore`), and set with `wrangler secret put` for the
  deployed Worker. It is never written in a tracked file or printed.
- `src/orders-test.ts <edge-url> <origin-url> [n=20]`: sends n valid, n
  wrong-signature and n old-timestamp requests, prints status counts, median and
  p95 for each group, and the origin's `orderHits` before and after.
- Known limit: a valid request can be replayed inside the 5-minute window. A nonce
  that the Worker remembers would stop that. Not built.
- Checked so far: `tsc --strict` and `wrangler deploy --dry-run` pass, and a
  Node check shows the same signature from `createHmac` and from `crypto.subtle`.
  Nothing has been run on the Worker.

### Run

```
origin orderHits before: 0
valid                    n=20  status 200x20  median=36.1 ms  p95=130.7 ms
wrong signature          n=20  status 401x20  median=22.6 ms  p95=46.1 ms
old timestamp (10 min)   n=20  status 401x20  median=23.0 ms  p95=59.8 ms
origin orderHits after: 10   (increase = 10; only the valid group should add to it)
```

- All 20 valid requests returned 200. The only code path in the Worker that returns
  200 for `/orders` is the one that calls the origin and passes its answer back, so
  all 20 reached the origin.
- The origin's counter went up by 10, not 20. `orderHits` is a per-instance
  variable (the same effect as Day 15's `requestCount`), and `GET /orders-count`
  reached one instance. So the origin Worker probably ran as two instances that each
  counted 10. I did not confirm that. It means this counter cannot prove that
  rejected requests never reached the origin: it would also have stayed too low if
  they had.
- All 40 bad requests returned 401: 20 with a wrong signature and 20 with a correct
  signature on a timestamp 10 minutes old.
- Median time at the client: 22.6 ms (wrong signature), 23.0 ms (old timestamp),
  36.1 ms (valid). So a valid request cost about 13 ms more in the median. That
  difference includes the signature check and the call from the edge Worker to the
  origin Worker. I did not separate those two. p95 was 46.1, 59.8 and 130.7 ms.
  Each group is one run of 20, and the Mac was in `MAA`.
- A rejected request still takes about 23 ms at the client, which is mostly the
  network from the Mac to the edge, as in Part 1.

### Second run, with `wrangler tail day16-origin` open

```
origin orderHits before: 10
valid                    n=20  status 200x20  median=40.8 ms  p95=144.1 ms
wrong signature          n=20  status 401x20  median=23.0 ms  p95=45.5 ms
old timestamp (10 min)   n=20  status 401x20  median=27.5 ms  p95=76.2 ms
origin orderHits after: 20   (increase = 10; only the valid group should add to it)
```

The tail showed these origin requests for the run (all `Ok`): 20 lines of
`POST /orders` (one stamped 10:32:00 PM, nineteen stamped 10:32:01 PM) and one
`GET /orders-count`. TODO: count the `POST /orders` lines in your own terminal
output and write the number; I counted 20 in the pasted text.

- The run sent 60 requests to `/orders`: 20 valid and 40 bad. The origin saw 20
  `POST /orders`. That fits only the valid group reaching the origin. A bad request
  never got to the origin, because the Worker returns 401 before it calls `fetch`.
- The tail shows only one `GET /orders-count`, and the script makes two (before and
  after), and the first `POST` is listed before the `GET`. So the pasted tail is
  probably incomplete or its lines are out of order. It does not change the count of
  `POST /orders` lines, but it means the tail is not a perfect log. I did not
  investigate further.
- `orderHits` went from 10 to 20 on the instance that answered my count calls, again
  an increase of 10 for 20 valid requests. In both runs the instance I read counted
  half. That fits two origin instances sharing the requests, but I did not confirm
  it.
- Timing in this second run is close to the first: median 40.8 ms for valid, 23.0 ms
  and 27.5 ms for the two bad groups. The valid group costs about 13 to 18 ms more in
  the median (the signature check plus the hop to the origin, not separated).
- Limits: n = 20 per group, two runs, from the Mac in `MAA`. A replayed valid request
  inside the 5-minute window would pass; a nonce would stop that, and I did not
  build one.

## Part 5 — limits and what does not belong at the edge

All numbers below were read from the official documentation on **2026-10-07**.
They change, so check them again before relying on them.

| Fact                                           | Free plan                                                             | Paid plan                     | Source                                                              |
| ---------------------------------------------- | --------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| CPU time per HTTP request (Workers)            | 10 ms                                                                 | 5 min (default 30 s)          | https://developers.cloudflare.com/workers/platform/limits/          |
| Memory per isolate                             | 128 MB                                                                | 128 MB                        | same                                                                |
| Subrequests per request                        | 50                                                                    | 10,000 (up to 10M)            | same                                                                |
| Request body                                   | 100 MB (set by the Cloudflare plan: Free/Pro 100 MB, Business 200 MB) | same                          | same                                                                |
| Worker size, uncompressed                      | 64 MiB                                                                | 64 MiB                        | same                                                                |
| Worker start-up (global scope must run within) | 1 second                                                              | 1 second                      | same                                                                |
| My Worker after the build                      | 7.61 KiB (2.51 KiB gzip)                                              |                               | `wrangler deploy` output                                            |
| KV writes                                      | 1,000 per day, to different keys                                      | unlimited                     | https://developers.cloudflare.com/kv/platform/limits/               |
| KV writes to the same key                      | 1 per second                                                          | 1 per second                  | same                                                                |
| KV reads                                       | 100,000 per day                                                       | unlimited                     | same                                                                |
| Durable Object storage type                    | SQLite only                                                           | SQLite and key-value          | https://developers.cloudflare.com/durable-objects/platform/pricing/ |
| Durable Object requests                        | 100,000 per day                                                       | 1 million per month included  | same                                                                |
| Durable Object SQLite rows written             | 100,000 per day                                                       | 50 million per month included | same                                                                |
| Durable Object SQLite rows read                | 5 million per day                                                     | 25 billion per month included | same                                                                |
| Durable Object stored data                     | 5 GB total                                                            | 5 GB-month included           | same                                                                |

- Durable Object daily limits reset at 00:00 UTC, and operations over the limit fail
  with errors (same pricing page).
- The KV page I read does not say what happens when a limit is exceeded. In my run, 2
  of 50 concurrent writes to one key returned `429 Too Many Requests`.
- In the global scope of a Worker you may not generate random values, do
  asynchronous I/O or set timeouts. I know this from the runtime error on Day 15
  (the text is in that day's `solution.md`), not from the limits page.
- Cache API: "The Cache API is available globally but the contents of the cache do
  not replicate outside of the originating data center." (cache page, same date.)
  `cache.put` returns a `413` if `Cache-Control` says not to cache or the response is
  too large.
- Usage in this challenge, against the Free limits: about 50 KV writes per counter run
  (limit 1,000 a day); one Durable Object increment is one row written (limit
  100,000 a day). TODO: check the dashboard for the real KV and Durable Object
  usage today.

### Edge, origin, or both

**Draft answers from Claude, not your decisions.** Each one points at a number from
this document or from a run above. TODO: change any you disagree with, in your words.

| Task                                                                     | Draft answer                         | Reason                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Add a header, redirect by country, A/B test by cookie                 | Edge                                 | Needs only the request (`request.cf.country`, headers, cookies), no data from the origin, and little CPU (Free plan: 10 ms).                                                                                              |
| 2. Check a signed request or token, then pass it on                      | Both                                 | The edge checks and the origin does the work. In Part 4, 40 bad requests got 401 and only the 20 valid ones reached the origin. A valid request can be replayed inside the 5-minute window unless something remembers it. |
| 3. A product page that is the same for everyone and changes once an hour | Both                                 | The origin builds the page; the edge caches it. In Part 2 a hit took about 30 ms at the client and a miss about 2.1 s. Each data center keeps its own copy, so each needs its own first MISS.                             |
| 4. A shopping cart for one user                                          | Origin, or a Durable Object per cart | State that changes must have one writer. KV lost 47 of 48 increments in Part 3; a Durable Object counted all 50.                                                                                                          |
| 5. A report that reads 2 GB from a database and takes two minutes        | Origin                               | Memory is 128 MB per isolate, and CPU time is 10 ms (Free) or 30 s by default (Paid).                                                                                                                                     |
| 6. A WebSocket chat room (Day 10)                                        | Origin                               | The Part 3 Durable Object is the edge option that could hold the shared state, but I did not read the docs on Durable Objects and WebSockets and I did not test it. TODO: read, and change this if the docs allow it.     |

## Part 6 — put it together

- Timing: a request from my Mac to the deployed Worker cost 51 to 315 ms in 24 runs.
  Connection setup (TCP plus TLS) was between a half and three quarters of that, and
  the slow step moved between runs. The best total did not improve when the client
  was 2 ms from the edge (Part 1).
- Cache: the Cache API gave hits of about 30 ms against a 2.1 s origin. The `fetch`
  `cf` option did not cache in my test. After the 30 s limit, one caller paid the
  full miss (Part 2).
- State: KV lost updates under 50 concurrent writes; a Durable Object did not (Part
  3).
- Auth at the edge: bad requests were stopped at the edge and never reached the
  origin (Part 4).
- Decision table: see "Edge, origin, or both" above.

### Clean-up check

These are the steps, in order. I ran the clean-up and everything was deleted, but I
did not save the output of any step, so I cannot show it here. This section does
**not** prove the clean-up. The challenge asks for list commands with output; the
way to add that later is to run the checks in step 5 (the namespace list should be
`[]`) and look at the Workers and Durable Objects pages in the dashboard.

```
# 1. before
npx wrangler kv namespace list

# 2. delete the Durable Object (deploy a stub with the class marked deleted)
#    stub: ../cleanup/index.ts (returns "cleaned up") and ../cleanup/wrangler.toml with
#      name = "day16-edge"
#      [exports.Counter]  type = "durable-object"  state = "deleted"
(cd ../cleanup && npx wrangler deploy)

# 3. delete both Workers (this also removes the ORDERS_SECRET secret)
npx wrangler delete --name day16-edge
npx wrangler delete --name day16-origin

# 4. delete the KV namespace
npx wrangler kv namespace delete --namespace-id <id>

# 5. prove it
npx wrangler kv namespace list
curl -s -o /dev/null -w 'edge %{http_code}\n' https://day16-edge.day15-hash.workers.dev/where
curl -s -o /dev/null -w 'origin %{http_code}\n' https://day16-origin.day15-hash.workers.dev/
```

The Durable Objects docs
(https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/,
read 2026-10-07) say that deleting a Worker alone does not remove the Durable
Object namespace or its data, and that there is no trash for a namespace deleted
this way. I found no command that lists Durable Objects, so the dashboard is the
check for those.

Local clean-up to do before a commit: put `PASTE_NAMESPACE_ID_HERE` back in
`wrangler.toml`, delete `src/.dev.vars`, and delete the `cleanup/` folder.

## Key concepts learned

Drafts from the results above. TODO: rewrite in your words.

- A Worker has no region. The same code ran in `MAA` for my Mac and in `SIN` for Cloud
  Shell, with no setting changed.
- Connection setup is a large and uneven part of a short request, and a closer edge
  did not lower the best case (24 runs from the Mac, 12 from Cloud Shell).
- The Cache API keeps one copy per data center, and a caller whose request lands on an
  expired copy pays the full origin time.
- A counter that is read, changed and written back loses updates under concurrency
  (KV, Part 3); a Durable Object with one SQL update did not.
- A check at the edge stops bad requests before they reach the origin, but a counter
  kept in memory in the origin cannot prove it, because each instance counts alone.

## Gotchas / things that tripped me up

- `country` and `colo` are on `request.cf`, not on `request`. TypeScript needs the
  Workers types (`wrangler types`) to know about `cf`.
- `wrangler.toml` copied from Day 15 pointed at a file that did not exist
  (`main = "cloudfare/index.ts"`).
- The first `/where` returned 404 for `HEAD` and for any other path. An online
  speed-test tool got a 404 for that reason (probably; I did not confirm).
- In `wrangler dev`, `request.cf` looked like a stored copy (`.wrangler/cache/cf.json`),
  not data about the local connection.
- `npx tsx` treats a `.ts` file as CommonJS when there is no `package.json` with
  `"type": "module"`, so top-level `await` failed. The fix was to put the code in an
  `async function main()`.
- The first deploy of Part 3 failed with `KV namespace 'PASTE_NAMESPACE_ID_HERE' is not
valid [code: 10042]` because the namespace id was a placeholder. Creating the
  namespace then failed with "already exists", so I listed the namespaces to get the id.
  I do not know where the existing one came from.
- A per-instance counter (`orderHits`) read through a single request is not a total.
- Predictions for Parts 3 and 4 were not written before the runs.
- TODO: anything else.

## What I'd do differently

Facts from the work, as a draft. TODO: your words.

- Write the predictions for every part before the first run. I wrote them for Parts 1
  and 2 only.
- Run the reuse test (the same URL twice in one curl call) so that connection setup is
  timed on its own instead of inferred.
- Do the cross-location cache test properly: create the entry in one data center and
  call from the other within 30 seconds.
- Run Part 3 three times per store, and read the KV counter from a second location
  after 60 seconds.
- Count origin calls in a shared store (a Durable Object) or in the tail output, not
  in a per-instance variable.
- Put the signature check behind a nonce store to stop replays.

## Further reading

- https://developers.cloudflare.com/workers/runtime-apis/request/
- https://developers.cloudflare.com/workers/reference/how-workers-works/
- https://developers.cloudflare.com/workers/runtime-apis/cache/
- https://developers.cloudflare.com/workers/examples/cache-using-fetch/
- https://developers.cloudflare.com/kv/platform/limits/
- https://developers.cloudflare.com/kv/concepts/how-kv-works/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
