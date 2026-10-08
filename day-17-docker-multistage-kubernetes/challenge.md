# Day 17 — Docker Multi-stage Builds + Minimal Kubernetes

**Difficulty:** Intermediate
**Tech stack:** Docker (BuildKit), Kubernetes with kind, kubectl, Node.js 22 + TypeScript (the Day 15 core as the app)
**Estimated time:** 3-4 hours

## Why this matters

Days 15 and 16 ran your code on platforms that hid the machine: you handed
over a function, and someone else decided how it started, how many copies
ran, and what happened when one died. Today you take that job back, in the
smallest form that is still real. You build the image yourself, and then
you ask Kubernetes to run several copies of it and keep them healthy.

Two things go wrong for most people here. The first is the image: a
build that works but ships the compiler, the dev dependencies and a shell
that nothing needs, and takes minutes every time one line changes. The
second is the cluster: a rollout that looks fine until the new version is
broken, and a pod that takes 30 seconds to stop for no visible reason.
Both are easy to see if you measure them, and both are what multi-stage
builds and probes exist for.

The app is the Day 15 core (`/hash`, `/info` with an `instanceId` and a
`requestCount`). That is on purpose. On Day 15 you asked which platform gives
you two instances at once. Today you decide how many, and you can see them.

## Learning objectives

By the end of today you should be able to:

- Build the same app as a single-stage image and as a multi-stage image,
  and say, from numbers, what the second one removed
- Order the lines of a Dockerfile so that a one-line code change does not
  reinstall the dependencies, and show it with the build output
- Run the container as a non-root user with a read-only filesystem, and
  prove both
- Write a minimal Deployment and Service, and read what each field does
- Explain what a readiness probe and a liveness probe each do, and show one
  rollout that is protected by a probe and stops
- Show why a process that ignores SIGTERM makes a pod slow to stop, and fix it
- Delete everything you created and prove that nothing is left

## The challenge

Put all code in `src/`. Write down results as you go. The numbers you
measure are the evidence, the same way the plan output was on Day 14 and
the timings were on Day 16.

**Part 1 — the app and a naive image.** Copy Day 15's `core.ts` into `src/`.
Add `src/server.ts`: a small server built only on `node:http` that calls
`handle` for every request. It must also:

- answer `GET /healthz` with 200 and the text `ok`, without touching `handle`
- read the port from the `PORT` environment variable (default 8080)
- log one line per request to standard output

Run it on your Mac without Docker and check `/hash?input=abc` against the
SHA-256 you got on Day 15.

Write `src/Dockerfile.naive`: one stage, a full `node` image, copy
everything, install all dependencies, run the TypeScript with `tsx`. Write
your predictions first: how large will this image be, and how long will the
first build take? Then build it and record:

- `docker images` size
- the build time (use `time`)
- `docker history` for the image: the three largest layers

**Part 2 — multi-stage, and layer order.** Write `src/Dockerfile`:

- a **build** stage that installs dependencies with `npm ci`, and compiles
  the TypeScript (for example with `tsc`, or a bundler such as `esbuild`)
- a **runtime** stage from a smaller base that contains only the compiled
  output and the production dependencies (or nothing, if you bundled)
- a non-root user, set with `USER`
- a `.dockerignore` file

Write your predictions first: how much smaller will it be? When you change
one line in `server.ts` and rebuild, how many layers will come from the
cache? Then build, and record the size and the build time. Then do the cache
test:

1. Build once from clean (`--no-cache`).
2. Change one line in `server.ts`. Build again. Count the `CACHED` steps in
   the output and list which steps ran.
3. Break the layer order on purpose (copy all the sources before `npm ci`).
   Change the same line again. Build. Compare.

Put the three build outputs (trimmed to the step lines) in `solution.md`.

**Part 3 — prove what is in the image.** Using the image from Part 2, show
with commands, not with words:

- the user the process runs as (`docker run --rm <image> id`)
- that the root filesystem can be read-only
  (`docker run --read-only`) and that the app still works. If it fails,
  find out what writes and say what you did about it
- what is in the image that the app does not need. Compare the file list or
  the size of both images (`docker run --rm <image> ls ...`, or
  `docker image inspect`, or a tool such as `dive` if you want)
- that no secret or `.env` file is in any layer (`docker history
  --no-trunc`, and a search of the layer contents)
- the base image tag you used and why it is not `latest`

**Part 4 — a minimal cluster.** Install `kind` and `kubectl`, then create a
cluster with `kind create cluster --name day17`. Load your image with
`kind load docker-image` (the cluster cannot see images in your Docker
unless you do this, and you do not need a registry). Write two files in
`src/k8s/`:

- `deployment.yaml`: 3 replicas, the image you loaded, `imagePullPolicy:
  IfNotPresent`, resource requests and limits, a readiness probe and a
  liveness probe on `/healthz`, and `runAsNonRoot`
- `service.yaml`: a ClusterIP Service in front of it

Write your predictions first: if you call `/info` 30 times through
`kubectl port-forward service/...`, how many different `instanceId` values
will you see? And if you call it 30 times from a pod inside the cluster
(`kubectl run` with a `curl` image, calling the Service by name)? Then do
both and record the results. Explain the difference using what the
documentation says about `port-forward`. Also run `kubectl exec <pod> -- id`
and `kubectl get pods -o wide`, and put the output in `solution.md`.

**Part 5 — rolling update, bad update, slow stop.** Run a loop in a second
terminal that calls the Service (from inside the cluster) every 200 ms and
prints the status code. Keep it running through all three experiments.

1. **Good update.** Build `v2` (change one visible thing, for example add a
   version field to `/info`), load it, and update the Deployment. Set the
   update strategy explicitly (`maxUnavailable` and `maxSurge`) and say why.
   Count failed requests during the rollout.
2. **Bad update.** Build `v3` whose `/healthz` returns 500. Roll it out.
   Write down what `kubectl rollout status` and `kubectl get pods` show, and
   what the loop shows. Then run `kubectl rollout undo`. Which probe stopped
   the rollout, and what would have happened without it?
3. **Slow stop.** Time `kubectl delete pod <name>` for one pod. Predict the
   time first. Then add a handler for `SIGTERM` to `server.ts` (stop
   accepting connections, finish the open requests, exit), rebuild, redeploy
   and time it again. Check in the documentation what Kubernetes does when a
   pod is deleted (the grace period and the signal), and put the link and the
   date next to what you write.

**Part 6 — put it together in solution.md.** Write up what you observed: the
size table of both images, the three cache builds, the proof from Part 3, the
probe and rollout results, the stop times, and your own decision: when would
you not use Kubernetes for this app? Finish with the clean-up check.

### Requirements

- A single-stage and a multi-stage Dockerfile for the same app, with the
  sizes and build times of both
- The cache test with the build output of all three builds
- The container running as non-root, shown with a command
- A kind cluster with a 3-replica Deployment and a Service
- The `port-forward` and in-cluster results, with the explanation
- A good rollout, a bad rollout stopped by a probe, and `rollout undo`
- Predictions written before Parts 1, 2, 4 and 5, with whether each held
- `solution.md` written from real output

### Constraints

- Local only. No cloud account, no registry push, no paid service
- Never put a secret in the image, in a Dockerfile, or in a manifest. The
  app has none; keep it that way, and prove it in Part 3
- Do not use `latest` as a tag, for the base image or for your own images.
  Use a version, and write down where you read it and the date
- Do not use Helm, Kustomize, Skaffold or Tilt for the core challenge. You
  want to see the plain manifests
- Do not read image sizes or default values from memory or from this file.
  Measure sizes. Read documented defaults (such as the termination grace
  period) in the official documentation on the day, and write the date
- Delete everything when you finish, and prove it (see the clean-up check)

### Clean-up check

At the end, show that nothing is left: `kind get clusters` (empty),
`docker ps -a` (none of yours), `docker images` (none of yours) and
`docker system df` before and after. Check that the kind node container is
gone too. Remove `src/node_modules` and any `dist/` if you do not want them
in the repo (they should be in `.gitignore` anyway).

## Bonus round (optional)

- Build the runtime stage on a distroless base, and compare size, the
  presence of a shell, and `kubectl exec` (what can you still do in it?)
- Scan both images with a vulnerability scanner (for example Trivy or
  Docker Scout) and compare the counts. What did the multi-stage build change,
  and what did it not?
- Use a BuildKit cache mount for the npm cache and compare the rebuild time
  after a dependency change
- Add a `PodDisruptionBudget` and drain the kind worker node. What does the
  Deployment do?
- Add a `HorizontalPodAutoscaler`. What do you need to install first, and why?
- Run 3 replicas and show that `requestCount` on `/info` is not a global count,
  as on Day 15. Which of Day 4 (Redis) or Day 5 (DynamoDB) would you add to fix it?
- One paragraph: which of your earlier days would be a bad fit for a Deployment
  with 3 replicas, and why? Think about Day 8 (consumer groups), Day 10
  (WebSockets) and Day 13 (locks).

## Resources

- https://docs.docker.com/build/building/multi-stage/
- https://docs.docker.com/build/cache/
- https://docs.docker.com/reference/dockerfile/
- https://kind.sigs.k8s.io/docs/user/quick-start/
- https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
- https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
- https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination
- https://kubernetes.io/docs/reference/kubectl/generated/kubectl_port-forward/

---

Once you've built something, write up `solution.md` in this folder using
`../_template/solution.md` as a starting point.
