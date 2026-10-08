# Day 17 — Solution: Docker Multi-Stage Builds and Kubernetes

**Blog post:** <link, once published>
**LinkedIn post:** <link, once shared>

> Status: Parts 1 to 4 done. Part 5: experiment 1 (good update) done; experiment 2 (bad update) started, the rollout got stuck, but I did not record the undo; experiment 3 (slow stop) not done. Part 6 (clean-up and decision) not done. I stopped here because of time.

## Part 1 — App and naive image

### Predictions (written before building)

1. How big will the image be? The image size should be the size of the Node 22 image, plus a few KB for the server and its dependencies.
2. How long will the first build take? The build must download the Node 22 image and run the code. Running the code takes a few ms. The download should take a few seconds.

### What I built

- `src/server.ts`: HTTP server on `PORT` (default 8080), `GET /healthz` returns 200 `ok`, one log line per request. All other paths go to `core.ts` (the Day 15 core).
- `src/Dockerfile.naive`: `FROM node:22`, `COPY . .`, `RUN npm install`, `CMD` runs `tsx server.ts`.
- `src/.dockerignore`: keeps the Mac `node_modules` out of the image.

Check: `GET /hash?input=abc` in the container returned
`ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`. This is the correct SHA-256 of `abc`.

### Measured results

`docker images` for `day17:naive`:

```
IMAGE          ID             DISK USAGE   CONTENT SIZE
day17:naive    ee680c703e6f   1.7GB        421MB
```

`docker history` (platform arm64, Debian bookworm base, `NODE_VERSION=22.23.3`), layers with a size above 0 B:

```
592 MB    RUN apt-get ...        (base image)
210 MB    RUN apt-get ...        (base image)
210 MB    dpkg / Node install    (base image)
155 MB    Debian base            (base image)
51.7 MB   RUN apt-get ...        (base image)
50.1 MB   RUN npm install        (my Dockerfile)
5.41 MB   gpg / yarn             (base image)
49.2 kB   COPY . .               (my Dockerfile)
8.19 kB   WORKDIR /app           (my Dockerfile)
```

Build time (`time docker build --no-cache -f Dockerfile.naive -t day17:naive .`): `real 0m3.214s`. Build steps: `npm install` 1.1 s, exporting layers 1.1 s, unpacking 0.2 s. The earlier run without `--no-cache` gave `real 0m3.149s`.

Two things about this build:

- The `node:22` base image was already on my Mac, so "load metadata" took 0.0 s and nothing was downloaded. This build does not test my second prediction (the download).
- Step `[2/4] WORKDIR /app` still said `CACHED`, even with `--no-cache`. I do not know why. TODO: look up what `--no-cache` does in the docs and write the date.

Size of the base image alone (`docker images node:22`):

```
IMAGE     ID             DISK USAGE   CONTENT SIZE
node:22   0e5f90657369   1.64GB       418MB
```

Compare:

```
                 DISK USAGE   CONTENT SIZE
node:22          1.64GB       418MB
day17:naive      1.7GB        421MB
```

### What the output shows

- My first prediction was close. The naive image is the `node:22` image plus a small addition: about 3 MB more content size, and about 0.06 GB more disk usage (the two numbers are rounded, so this is approximate). Nearly all of the image is the base.
- What I did not predict is how big the base is: 1.64 GB on disk. The `node:22` image is a full Debian image with build tools.
- My own layers are `npm install` (50.1 MB in `docker history`), the app files (49.2 kB) and `WORKDIR` (8.19 kB). `npm install` also installs the dev dependencies (`typescript`, `tsx`, `@types/node`), so they are in the final image.
- The two size columns differ (1.64 GB against 418 MB for the same image). I think "content size" is the compressed size and "disk usage" is the unpacked size, but I did not check this in the docs. TODO: check and write the date.
- The `docker history` layer sizes add up to about 1.27 GB, not 1.64 GB. I do not know the reason for the difference.
- My second prediction (a few seconds, mostly download) was not tested, because the base image was already local. The build took 3.2 s with no download.
- The image runs TypeScript with `tsx` at start-up. It has the dev dependencies and the source in the final image. This is what Part 2 should remove.

### Not measured

- A build that has to download the base image. (I could run `docker rmi node:22` and rebuild, but this would also remove the base for later parts.)
- Start-up time of the container.

## Part 2 — Multi-stage build

### Predictions (written before building)

1. How big will the multi-stage image be, compared with 1.7 GB? It should be bigger than 1.7 GB, maybe 2 GB or more.
2. After I change one line in `server.ts` and rebuild, how many layers will say `CACHED`, and which ones? 4 layers, all of the layers.

### What I built

`src/Dockerfile` has two stages. The build stage (`node:22`) copies `package.json` and `package-lock.json`, runs `npm ci`, copies the sources, and runs `npm run build` (esbuild bundles `server.ts` and `core.ts` into `dist/server.mjs`). The runtime stage (`node:22-slim`) copies only `dist/` from the build stage and runs it as the user `node`. There is no `node_modules` in the final image.

### First build (`time docker build -t day17:multi .`, no `--no-cache`)

```
[stage-1 1/3] FROM node:22-slim                 2.8s   (downloaded, 49.96MB layer)
CACHED [build 2/6] WORKDIR /app                 0.0s
[build 3/6] COPY package.json package-lock.json 0.0s
[build 4/6] RUN npm ci                          1.2s
[build 5/6] COPY . .                            0.0s
[build 6/6] RUN npm run build                   0.2s
[stage-1 2/3] WORKDIR /app                      0.2s
[stage-1 3/3] COPY --from=build /app/dist ./dist 0.0s

Building 5.8s, real 0m6.389s
```

The build time includes the download of `node:22-slim` (2.8 s). It is not a clean build: `node:22` and its `WORKDIR /app` layer were already on my Mac from Part 1.

### Sizes

```
IMAGE         DISK USAGE   CONTENT SIZE
day17:multi   346MB        79.8MB
day17:naive   1.7GB        421MB
```

- The multi-stage image is smaller: 346 MB against 1.7 GB on disk (about 4.9 times), and 79.8 MB against 421 MB content size (about 5.3 times). I worked out the ratios from the rounded numbers.
- My prediction was wrong in direction. I said it would be bigger than 1.7 GB. The reason it is smaller: the final image starts from `node:22-slim` and contains only the 2.1 kB bundle. The compiler, `node_modules` and the Debian build tools stay in the build stage and are not copied.
- I did not measure `node:22-slim` alone, so I do not know how much of the 346 MB is the base. TODO: `docker images node:22-slim`.
- Prediction 2 is checked in the cache test below.

### Cache test (three builds)

Build step lines only. `CACHED` lines are marked. Step names are as Docker printed them.

**Build 1: `docker build --no-cache -t day17:multi .`** (total 3.7 s)

```
CACHED [build 2/6] WORKDIR /app
CACHED [stage-1 2/3] WORKDIR /app
[build 3/6] COPY package.json package-lock.json ./   0.0s
[build 4/6] RUN npm ci                               1.2s
[build 5/6] COPY . .                                 0.0s
[build 6/6] RUN npm run build                        0.2s
[stage-1 3/3] COPY --from=build /app/dist ./dist     0.0s
```

2 steps said `CACHED` even with `--no-cache`. The same thing happened in Part 1 (`WORKDIR /app`). I do not know why. TODO: read the `--no-cache` docs and write the date here.

**Build 2: after `echo "// cache test 1" >> server.ts`, then `docker build -t day17:multi .`** (total 1.4 s)

```
CACHED [build 2/6] WORKDIR /app
CACHED [build 3/6] COPY package.json package-lock.json ./
CACHED [build 4/6] RUN npm ci
[build 5/6] COPY . .                                 0.0s
[build 6/6] RUN npm run build                        0.2s
CACHED [stage-1 2/3] WORKDIR /app
CACHED [stage-1 3/3] COPY --from=build /app/dist ./dist
```

- 5 steps said `CACHED`, 2 steps ran: `COPY . .` and `npm run build`. `npm ci` did not run again, because `package.json` and `package-lock.json` did not change.
- The last step (`COPY --from=build ...`) also said `CACHED`, although the source file changed. The comment I added is not part of the esbuild output, so `dist/server.mjs` was the same file as before. The image manifest hash is the same in builds 1 and 2 (`b79078c7db4b...`), which supports this. I did not compare the two `dist/server.mjs` files directly.
- Prediction 2 (4 layers, all of them): wrong. 5 steps were cached, not 4, and not all. `COPY . .` must run again after a source change, because the files in it changed.

**Build 3: layer order broken on purpose**

The build stage was changed to:

```
FROM node:22 AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build
```

I built once to fill the cache (2.6 s). Then I ran `echo "// cache test 2" >> server.ts` and built again (total 1.8 s):

```
CACHED [build 2/5] WORKDIR /app
[build 3/5] COPY . .                                 0.0s
[build 4/5] RUN npm ci                               1.0s
[build 5/5] RUN npm run build                        0.2s
CACHED [stage-1 2/3] WORKDIR /app
CACHED [stage-1 3/3] COPY --from=build /app/dist ./dist
```

- 3 steps said `CACHED`, 3 steps ran. `npm ci` ran again (1.0 s), although no dependency changed. `COPY . .` comes before it, so any change to any source file changes that layer, and every step after it must run again.
- The final image is the same again (manifest `b79078c7db4b...`), because the bundle did not change.

**Comparison (one run of each, so these are single samples):**

```
                        CACHED steps   ran            npm ci    total
good order, build 2     5              2              cached    1.4 s
broken order, build 3   3              3              1.0 s     1.8 s
```

- The broken order cost 1.0 s for `npm ci` and 0.4 s in total. The effect is small here because the app has only four dev dependencies and `npm ci` takes about 1 s. I did not test an app with many dependencies, so I cannot say how big the effect would be there.
- The `load metadata for node:22-slim` step took 0.5 to 1.0 s in the later builds. This is a check against the registry and is not part of my Dockerfile. In the total of 1.4 s for build 2, it is a large part. I did not look at how much of it runs in parallel with other steps.

### Clean-up of the test

`Dockerfile` was restored from `Dockerfile.good` (checked with `diff`: same). TODO for me: delete `Dockerfile.good` and the two `// cache test` lines at the end of `server.ts`.

## Part 3 — Prove what is in the image

### No secret in the image

First try: I built the image, then created `.env`, then searched. This proves nothing, because the file did not exist at build time. I did it again in the right order.

Test, in this order (`src/`):

```
echo "FAKE_SECRET=abc123" > .env
docker build -t day17:multi .
docker history --no-trunc day17:multi | grep -i fake_secret; echo "history exit: $?"
docker run --rm --entrypoint sh day17:multi -c 'find / -name ".env*" -not -path "/proc/*" 2>/dev/null; grep -r FAKE_SECRET /app 2>/dev/null; echo "grep exit: $?"'
rm .env
```

Output:

```
history exit: 1
grep exit: 1
```

- Exit code 1 means `grep` found no match. `find` printed no `.env` file.
- Positive control (the search can find things): `grep -c listening /app/dist/server.mjs` printed `1`, and `find` printed `/app/dist/server.mjs`.
- In the build output of this run, `[build 5/6] COPY . .` said `CACHED` and the build context was `190B`, the same size as in earlier builds without `.env`. So the new `.env` file did not reach the build context. The `.dockerignore` file lists `.env`. This is my reading of the output.
- The paste does not show the `echo ... > .env` line, because it prints nothing. I am assuming it ran before the build, as I told you.
- `docker history` only covers the final image. The build stage is not in it. The build stage did not contain `.env` either, by the context size above, but I did not search it.
- Docker Desktop printed the "Debug with Gordon" hint after the last command. The command had exit code 1 only because of how `find` or `grep` ended. It was not a container error.
- `bash: child setpgid ... Operation not permitted` printed before the build. I do not know the cause. The build was not affected.

### Which user runs the process

```
$ docker run --rm day17:multi id
uid=1000(node) gid=1000(node) groups=1000(node)

$ docker image inspect day17:multi --format '{{.Config.User}} {{.Config.Cmd}}'
node [node dist/server.mjs]
```

The process does not run as root. The user `node` already exists in the `node` base images, so the Dockerfile only needs `USER node`.

### Read-only root filesystem

First run (foreground):

```
$ docker run --rm --read-only -p 8081:8080 day17:multi
listening on 8080
^C^C^C
got 3 SIGTERM/SIGINTs, forcefully exiting
```

Second run (detached, `docker run -d --rm --read-only --name d17ro -p 8081:8080 day17:multi`):

```
$ curl "localhost:8081/hash?input=abc"
{"input":"abc","sha256":"ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"}

$ docker exec d17ro sh -c 'touch /app/x; echo "touch /app exit: $?"; touch /tmp/x; echo "touch /tmp exit: $?"'
touch: cannot touch '/app/x': Read-only file system
touch /app exit: 1
touch: cannot touch '/tmp/x': Read-only file system
touch /tmp exit: 1

$ time docker stop d17ro
d17ro
real    0m3.248s
```

- The app works with `--read-only`: it started, and `/hash?input=abc` returned the correct hash.
- Writes are refused. Both `/app` and `/tmp` returned "Read-only file system" (exit 1). So the root filesystem was really read-only during the test. The app does not write any files, so nothing needed fixing. An app that writes temp files would need a writable mount such as `--tmpfs /tmp`. I did not test that.
- The first run (foreground) failed with "port is already allocated" for 8081 the next time I tried. I think the first container was still running after the Docker client printed "forcefully exiting". I did not see `docker ps` output, so this is not confirmed.
- It took three Ctrl+C presses in the foreground run.
- `docker stop` took 3.248 s. I had guessed that a server without a signal handler would take the full wait. I think the Docker default wait is 10 s, but I did not check the docs (TODO: check and write the date). 3.2 s is not 10 s, so my guess does not match this measurement. I do not know why. One sample. Part 5 measures the pod stop time in Kubernetes before and after adding a SIGTERM handler.

### What is in the image that the app does not need

```
naive: du -sh /app  ->  37M     ls /app: core.ts node_modules package-lock.json package.json server.ts tsconfig.json
multi: du -sh /app  ->  12K     /app/dist/server.mjs  2154 bytes, owned by root, mode -rw-r--r--
```

- The naive image has 37 MB in `/app`: the TypeScript sources, `tsconfig.json`, the lock file and `node_modules`. `du` counted `node_modules` inside `/app` and did not print it separately. `node_modules` holds `typescript`, `tsx` and the other dev dependencies, which the running server does not need.
- The multi-stage image has one 2154-byte file in `/app`.
- `/app` and `dist` are owned by root and the process runs as `node` (uid 1000), so the app cannot write there. This fits the read-only start.
- The sizes in `docker history` (50.1 MB for `npm install`) and from `du` (37 MB) measure different things. I did not compare them.

## Part 4 — A minimal cluster

### Setup notes

- Homebrew on my Mac is the Intel copy (`/usr/local`) on an Apple Silicon Mac (`uname -m` gave `arm64`). `brew install` tried to compile `kubectl` from source and failed. I downloaded `kind` and `kubectl` as binaries into `~/bin` instead.
- My first `kubectl` download saved an XML error page, because I pasted the word `VERSION` into the URL. After using the real version it worked: `Client Version: v1.37.1`, `Kustomize Version: v5.8.1`.
- `kind version` first showed `darwin/amd64` (Intel build, run through Rosetta). TODO: write here whether I replaced it with the arm64 build.
- Cluster created with `kind create cluster --name day17`. The image was tagged `day17:v1` (`docker tag day17:multi day17:v1`) and loaded with `kind load docker-image day17:v1 --name day17`. Output: `Image: "day17:v1" with ID "sha256:80d712690e98..." not yet present on node "day17-control-plane", loading...`
- First `kubectl apply -f k8s/` failed with `the path "k8s/" does not exist`, because I ran it from `~/bin` and not from `src/`.

### Predictions (written before the tests)

1. 30 calls to `/info` through `kubectl port-forward service/day17`: how many different `instanceId` values? 30.
2. 30 calls from a pod inside the cluster, using the Service name: how many? 1.

### Results

**Through `kubectl port-forward service/day17 8082:80`, 30 calls to `/info`:**

```
  30 "instanceId":"7fe07c18-909a-4f85-8da2-3b7d1178510b"
```

The forward log showed `Forwarding from 127.0.0.1:8082 -> 8080` and 30 lines `Handling connection for 8082`, with no errors. My prediction was 30 different values. The result was 1.

**From a pod inside the cluster, calling `http://day17/info` 30 times**

First attempt (`kubectl run --rm -i ... | grep`): only 25 of 30 results were counted.

```
   7 "instanceId":"7fe07c18-909a-4f85-8da2-3b7d1178510b"
   9 "instanceId":"983c63a9-c50d-4b84-bc4a-5b4e563b98d2"
   9 "instanceId":"afdcf71e-c2c9-4a26-908d-05c8494045bd"
```

I do not know where the other 5 went. Possibly the attach lost the first lines of output (a guess, not checked). I ran it again with the output written to the pod log and read with `kubectl logs`:

```
$ kubectl logs curl-test2 | grep -c '^200$'
30
$ kubectl logs curl-test2 | grep -o '"instanceId":"[^"]*"' | sort | uniq -c
   4 "instanceId":"7fe07c18-909a-4f85-8da2-3b7d1178510b"
  14 "instanceId":"983c63a9-c50d-4b84-bc4a-5b4e563b98d2"
  12 "instanceId":"afdcf71e-c2c9-4a26-908d-05c8494045bd"
```

The second run was a separate set of 60 calls (30 status codes, then 30 for the IDs): 30 of 30 status codes were 200, and 3 different `instanceId` values were counted, 30 in total. My prediction was 1. The result was 3, the same as the number of replicas.

- The split between the three values was 7/9/9 in the first attempt and 4/14/12 in the second. Each is one sample of 30 calls. I did not look into why the split is uneven, and I have no explanation for it.
- Which `instanceId` belongs to which pod (`kubectl exec <pod> -- node -e "fetch('http://localhost:8080/info')..."`, one call per pod):

```
pod/day17-5f84d8bd8-6nk9c   7fe07c18-909a-4f85-8da2-3b7d1178510b   requestCount 52
pod/day17-5f84d8bd8-njnfk   afdcf71e-c2c9-4a26-908d-05c8494045bd   requestCount 40
pod/day17-5f84d8bd8-z9jr5   983c63a9-c50d-4b84-bc4a-5b4e563b98d2   requestCount 34
```

  The `port-forward` calls all hit pod `6nk9c`, the one with `7fe07c18...`. The forward log does not name the pod. I know it from the `instanceId` in the answers.
- The three `requestCount` values add up to 126. The `/info` calls I made add up to 123 (30 forward + 30 + 30 + 30 in-cluster + 3 from the `exec` calls above). I do not know where the 3 extra calls came from. `/healthz` probes are not counted by the app.
- Both predictions were wrong. For prediction 1, 30 different values was not possible with only 3 pods, because `instanceId` is created once per process (`core.ts`).

**Why the difference (docs):** TODO. I need one sentence from the `kubectl port-forward` reference page (https://kubernetes.io/docs/reference/kubectl/generated/kubectl_port-forward/), with the date I read it.

**`kubectl get pods -o wide`:**

```
NAME                    READY   STATUS    RESTARTS   AGE     IP           NODE                  
day17-5f84d8bd8-6nk9c   1/1     Running   0          4m37s   10.244.0.6   day17-control-plane   
day17-5f84d8bd8-njnfk   1/1     Running   0          4m37s   10.244.0.7   day17-control-plane   
day17-5f84d8bd8-z9jr5   1/1     Running   0          4m37s   10.244.0.5   day17-control-plane   
```

All three pods are `1/1 Running` with 0 restarts, on the single node of the kind cluster (one Docker container). Their IPs are on the pod network `10.244.0.x`.

**`kubectl exec deploy/day17 -- id`:**

```
uid=1000(node) gid=1000(node) groups=1000(node)
```

The process runs as `node` (uid 1000) inside the cluster, as it did in Docker.

## Part 5 — Rolling update, bad update, slow stop

### Setup

- A pod named `loop` (image `curlimages/curl`) calls `http://day17/info` about every 200 ms from inside the cluster and prints the time and the HTTP status code (`000` would mean no answer within 1 s). Its output is saved with `kubectl logs -f loop | tee /tmp/loop.log`.
- `core.ts` returns `"version": "v2"` in `/info` for the `day17:v2` image. The `day17:v1` image does not have this field.
- `k8s/deployment.yaml` sets `strategy: RollingUpdate` with `maxUnavailable: 0` and `maxSurge: 1`.

### Experiment 1: good update (v1 to v2)

Prediction (failed requests during the update): TODO, not given.

Command: `kubectl set image deployment/day17 app=day17:v2`, then `kubectl rollout status deployment/day17`.

Result:

```
$ wc -l /tmp/loop.log
     745 /tmp/loop.log
$ grep -vc ' 200$' /tmp/loop.log
0
```

- 745 requests were logged and none had a status other than 200. This is one run.
- `kubectl get pods` right after the rollout showed the 3 old pods `Terminating` (age 12m) and 3 new pods `Running` (ages 15 s, 18 s and 21 s):

```
day17-5f84d8bd8-6nk9c    1/1   Terminating   0   12m
day17-5f84d8bd8-njnfk    1/1   Terminating   0   12m
day17-5f84d8bd8-z9jr5    1/1   Terminating   0   12m
day17-786cb45855-9vjdp   1/1   Running       0   18s
day17-786cb45855-bvqjq   1/1   Running       0   21s
day17-786cb45855-zq9lr   1/1   Running       0   15s
```

- Why `maxUnavailable: 0` and `maxSurge: 1`: with 3 replicas this keeps all 3 pods serving while Kubernetes starts one new pod, waits until it is ready, and only then stops an old one. The cost is one extra pod for a short time. This reasoning is mine; the measurement above is one run and does not prove that the setting is the reason there were no failures. I did not run the update with other settings.
- TODO: the output of `kubectl rollout status`, the first and last time in `/tmp/loop.log`, and a check that the answers now contain `"version":"v2"`.

### Experiment 2: bad update (v3, `/healthz` returns 500)

Prediction: TODO, not given.

`day17:v3` was built from `server.ts` with line 20 changed to `writeHead(500, ...)`, then `server.ts` was restored from a copy. TODO: confirm line 20 says `200` again (output of `sed -n 20p server.ts`).

```
$ kubectl set image deployment/day17 app=day17:v3
deployment.apps/day17 image updated
$ kubectl rollout status deployment/day17 --timeout=60s
Waiting for deployment "day17" rollout to finish: 1 out of 3 new replicas have been updated...
error: timed out waiting for the condition
$ kubectl get pods
NAME                     READY   STATUS    RESTARTS   AGE
day17-55b48b4cf4-nb7ht   0/1     Running   0          60s
day17-786cb45855-9vjdp   1/1     Running   0          8m45s
day17-786cb45855-bvqjq   1/1     Running   0          8m48s
day17-786cb45855-zq9lr   1/1     Running   0          8m42s
loop                     1/1     Running   0          10m
```

- The rollout did not finish. Only 1 new pod (`nb7ht`) was created. It was `Running` but `0/1` ready after 60 s. The 3 old v2 pods stayed `1/1 Running`.
- The loop (`/tmp/loop-bad.log`, 491 lines): `grep -vc ' 200$'` gave `0`. No request failed. I do not know when I stopped the log relative to the next steps (TODO: undo output).
- My `describe` command printed the probe settings of the 4 pods (liveness `delay=5s period=10s #failure=3`, readiness `delay=1s period=2s #failure=3`) and no `Unhealthy` event lines. I do not know why. TODO: `kubectl describe pod day17-55b48b4cf4-nb7ht | tail -25`.
- RESTARTS was 0 at 60 s. I expected the liveness probe to start restarting the container sooner than that (5 s delay and 3 failures at 10 s intervals). I do not know why it had not. TODO: a later `kubectl get pods`.

### Experiment 3: slow stop

Not done.

## Part 6

Not done. The kind cluster `day17`, the Deployment, the Service and the `loop` pod were still there when I stopped. No clean-up output was saved.

## Approach

I built the Day 15 core as a plain Node HTTP server, put it in a naive image (`FROM node:22`, `npm install`, run with `tsx`), and measured it. Then I wrote a two-stage Dockerfile (esbuild bundle, copied into `node:22-slim`), tested the cache with three builds, and checked the image with commands. Then I ran it in a local kind cluster with 3 replicas and tried a rolling update and a bad update. I did not finish the slow-stop experiment or the clean-up.
## Key concepts learned

- Most of the naive image is the base image, not my code: `node:22` is 1.64 GB on disk, `day17:naive` is 1.7 GB. The multi-stage image is 346 MB (79.8 MB content size).
- Layer order decides what the cache can reuse. With `COPY package*.json` and `npm ci` first, a one-line source change re-ran 2 steps. With `COPY . .` first, `npm ci` ran again (3 steps ran). The time difference was 0.4 s in one sample, because this app has few dependencies.
- A Service spreads calls over pods, `kubectl port-forward service/...` did not: 30 calls gave 1 `instanceId` through `port-forward` and 3 from a pod inside the cluster (30 of 30 returned 200). The docs explanation is still a TODO.
- With `maxUnavailable: 0` and `maxSurge: 1`, a v3 pod that fails its probe kept the rollout stuck at 1 new pod while the 3 old pods stayed `1/1 Running`. No request in the loop failed in either update (745 and 491 lines, one run each). I did not read the probe events, so which probe held the rollout back is my reading of `READY 0/1`, not something I checked.
## Gotchas / things that tripped me up

- `docker run` gave "pull access denied for day17": the image did not exist yet because I had not run `docker build`. Docker tried to find it on Docker Hub.
- "port is already allocated" twice (8080 and 8081): an earlier container or the local `tsx` server was still using the port.
- First `server.ts`: `new URL(req.url)` without a base URL throws, and `JSON.parse` on an empty GET body returned 400.
- `docker history` with a typo (`history --no-trunc` without `docker`) ran the shell command `history`. The secret test only counts if `.env` exists before the build.
- Homebrew on this Mac is the Intel copy (`/usr/local`) on an `arm64` machine. `brew install` tried to compile `kubectl` and failed. I used the binaries from the project sites. My first `kubectl` download saved an error page, because the word `VERSION` was in the URL.
- I set `runAsUser: 1000` in the Deployment, because Kubernetes cannot verify `runAsNonRoot` for a user named `node`. I did not test the Deployment without it.
## What I'd do differently

- Finish what I did not do: the undo of v3 with its output, the probe events, the slow-stop timing before and after a `SIGTERM` handler, and the clean-up (`kind delete cluster --name day17`, `docker system df`).
- Read the `kubectl port-forward` docs and write the sentence that explains the 1 against 3 result.
- Measure a build that has to download the base image, and a project with many dependencies for the cache test.
- Find out why `--no-cache` still printed `CACHED` for `WORKDIR`, and why `docker stop` took 3.2 s and not 10 s.

## Further reading

- https://docs.docker.com/build/cache/
- https://kubernetes.io/docs/reference/kubectl/generated/kubectl_port-forward/
