Day 17 of the 30-day challenge: Docker multi-stage builds and a local Kubernetes cluster. I put a small Node server in a naive image and a multi-stage image, then ran it in a kind cluster with three replicas.

The naive image was 1.7 GB, and most of that was the base image, not my code. My own layers were an npm install of 50 MB and 49 kB of app files. The multi-stage image was 346 MB, because the final stage holds only one 2 kB bundle. I checked it with commands: it runs as user node, it still answers requests with a read-only root filesystem, and a search found no secret from a fake .env file I made before the build.

My cache prediction was wrong. I said that after a one-line change all layers would be cached. In the good layer order, 5 steps were cached and 2 ran. With the sources copied before npm ci, npm ci ran again, 1.0 s for no reason. That was one run each, and my app has few dependencies, so I cannot tell how big the effect is in a real project.

The result I will remember: I predicted 30 different instance ids through kubectl port-forward to a Service, and 1 from a pod inside the cluster. The real numbers were 1 and 3. With three pods, 30 was never possible. Every port-forward call went to the same pod. I have not read the docs explanation yet, so I do not claim a reason.

I did not finish. The bad update rollout stopped as expected, with old pods still serving and no failed request in my loop, but I did not read the probe events or record the undo. The slow-stop test and the clean-up are not done.

Full writeup on the blog, including what I did not measure: <link>

#30DayChallenge #Docker #Kubernetes #DevOps #TypeScript #SoftwareEngineering
