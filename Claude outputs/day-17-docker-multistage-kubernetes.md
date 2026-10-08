---
title: "Day 17 — From 1.7 GB to 346 MB, and a Service That port-forward Is Not"
date: "2026-10-08"
excerpt: "A small Node server in a naive Docker image, then in a multi-stage one, then in a local Kubernetes cluster. Image sizes, a cache test, and a surprise in how many pods answered. I did not finish the whole plan, and this post says what is missing."
tags: ["30-day-challenge", "day-17", "docker", "kubernetes", "kind", "typescript"]
draft: true
---

Day 16 ran code at the edge, with no region to pick. Day 17 goes the other way:
a container that I build, size and run myself, first with Docker and then in a
local Kubernetes cluster made with `kind`. I took the Day 15 core (a hash route
and an info route), wrapped it in a plain Node HTTP server, and measured what
happened. I did not finish the plan. The slow-stop test, the undo of the bad
update and the clean-up are missing, and I say where below.

## A 1.7 GB image for 2 kB of code

The first image was the simple one: `FROM node:22`, `COPY . .`, `npm install`,
run the TypeScript with `tsx`.

```
                DISK USAGE   CONTENT SIZE
node:22         1.64GB       418MB
day17:naive     1.7GB        421MB
```

My prediction was "the size of Node 22 plus a few KB". The shape was right: my
own layers were `npm install` (50.1 MB) and the app files (49.2 kB). I did not
expect the base image itself to be 1.64 GB. The first prediction about build time
("a few seconds, mostly download") I could not test, because `node:22` was
already on my Mac. The build took 3.2 s with nothing to download.

## Multi-stage: 346 MB

The second Dockerfile has two stages. The first runs `npm ci` and bundles
`server.ts` and the core into one file with esbuild. The second starts from
`node:22-slim` and copies only that file. It runs as the user `node`.

```
                DISK USAGE   CONTENT SIZE
day17:multi     346MB        79.8MB
day17:naive     1.7GB        421MB
```

I predicted it would be bigger than 1.7 GB. It was about five times smaller. The
final `/app` holds one 2154-byte file, where the naive one holds 37 MB of sources
and `node_modules`. I did not measure `node:22-slim` alone, so I cannot say how
much of the 346 MB is just the base.

I checked the image with commands. The process runs as `uid=1000(node)`. With
`--read-only` the server still answered `/hash?input=abc` correctly, and a
`touch` in `/app` and in `/tmp` was refused. I made a fake `.env` file and built
again. `docker history` and a search inside the image found nothing, and a search
for a word that is in the bundle found it, so the search works. My first try
proved nothing, because I made the `.env` after the build.

## The cache test

Three builds. One line added to `server.ts` each time.

```
                        steps cached   steps that ran        total
good order              5              COPY . . , build      1.4 s
broken order            3              COPY . . , npm ci, build   1.8 s
```

My prediction was "4 layers, all of them". Wrong: `COPY . .` has to run again
when a source file changes. In the good order `npm ci` stayed cached. In the
broken order, with `COPY . .` first, `npm ci` ran again for 1.0 s although no
dependency had changed. That is one run of each and the app has few
dependencies, so I cannot tell how large the effect is in a real project.

One more thing: the last step (copy the bundle into the final image) stayed
cached even after the source change. The comment I added does not appear in the
esbuild output, and the final image had the same manifest hash in all builds. I
did not compare the two bundle files directly.

## Three pods, how many `instanceId` values?

I put the image in a kind cluster, with 3 replicas and a Service in front. The
`/info` route returns an `instanceId` that each process makes once. I wrote two
predictions: 30 different values through `kubectl port-forward service/day17`,
and 1 value from a pod inside the cluster.

```
port-forward, 30 calls     1 value
from inside, 30 calls      3 values (4, 14, 12 calls)
```

Both predictions were wrong. With 3 pods, 30 values was never possible. The
`port-forward` calls all went to one pod. The calls from inside went to all
three. My first try inside the cluster counted only 25 of 30 results, and I do
not know why. I ran it again, reading the pod log, and got all 30 (every status
was 200). The split between the pods was uneven, 7/9/9 in the first run and
4/14/12 in the second, and I have no explanation for that. I have not yet read
what the `port-forward` documentation says about Services, so I do not
claim a reason.

## A good update and a bad one

I ran a loop in the cluster that called the Service about every 200 ms and
printed the status code. The Deployment has `maxUnavailable: 0` and
`maxSurge: 1`.

The update from v1 to v2 logged 745 requests and none had a status other than
200. Then I made v3, whose `/healthz` returns 500. The rollout stopped at one
new pod that was `Running` but `0/1` ready, while the three old pods stayed
`1/1 Running`. The loop logged 491 requests and none failed.

That is what I saw. What I did not see: the probe events (my `describe` command
printed none), a restart of the new pod after 60 s (I expected the liveness probe
to cause one), and the undo. So I cannot say from my own output which probe held
the rollout back. `READY 0/1` points to the readiness probe, and that is a
reading, not a check.

## Things that went wrong on the way

My Homebrew is the Intel copy on an Apple Silicon Mac, so `brew install` tried to
compile `kubectl` and failed. I downloaded the programs directly, and my first
`kubectl` download saved an error page because I pasted the word `VERSION` into
the URL. Two of my `docker run` commands failed with "port already in use" (8080 and
8081), because an earlier process or container was still using the port.

## What I'm leaving open

The slow stop (time `kubectl delete pod` before and after a `SIGTERM` handler)
is not done. My only data point is that `docker stop` on the plain Docker
container took 3.2 s. I guessed that a server without a handler would take the
full default wait, and I think that default is 10 s, but I did not check the
docs. The undo of v3 is not recorded, and the clean-up is not done: the cluster
was still running when I stopped. No scanner, no distroless image.

## What's next

Day 18 is observability with OpenTelemetry. Full code in the [repo](#) —
`day-17-docker-multistage-kubernetes/`.
