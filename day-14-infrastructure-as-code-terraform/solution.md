# Day 14 — Solution: Infrastructure as Code with Terraform

**Blog post:** <link, once published>
**LinkedIn post:** <link, once shared>

## Setup

```
cd src
terraform init
terraform plan
terraform apply                              # one instance (enable_redlock = false)
terraform apply -var enable_redlock=true     # all five (or put it in terraform.tfvars)
terraform output redis_urls
terraform destroy                            # only at the very end
```

Day 13's Redlock script runs against the result unchanged (`npm run part5`
from the Day 13 `src/` folder). Free ports 6379-6383 first: stop any old Redis
container that publishes them.

## Approach

Terraform with the `kreuzwerker/docker` provider (v3.0.2), so every Terraform
concept (resources, dependencies, state, plan, apply, drift, locking) is
exercised on containers I already understood from Day 13, with no cloud
account and no cost. I started with one container (Part 1), grew it to Day 13's
five-instance layout with a variable, `for_each` and an output (Part 2), then
spent the rest of the day changing, breaking, and racing it: edits to read
plans (Part 3), drift made behind Terraform's back (Part 4), and two `apply`
runs at once (Part 5). The `docker-compose.yml` from Day 13 became the thing to
compare against.

## Key concepts learned

- **State maps the config to real objects, and the plan is the diff between
  the two plus reality.** Part 1: `terraform plan` said `1 to add`, `apply`
  created `redis-day14`, `redis-cli ping` answered `PONG`, and
  `terraform state list` showed `docker_container.redis` and
  `docker_image.redis`. `terraform state show` listed every attribute
  Docker had assigned — hostname, `172.17.0.2` on the default `bridge`
  network, `working_dir = /data` — which the plan had only labelled
  "(known after apply)".

- **The whole Day 13 topology fits in one variable, one `for_each` and one
  switch — and Day 13's script ran against it unchanged.**
  `enable_redlock = false` creates `redis-6379` only; `true` creates all five,
  each with a `redis-cli ping` healthcheck. After the apply `docker ps`
  showed five `(healthy)` containers, and `npm run part5` reported
  `Reachable instances: 5/5` with the same votes as on Day 13. That is the
  proof the code describes the same system as the compose file.

- **A plan right after a successful apply must be empty — mine was not.**
  After the redlock apply, `terraform plan` wanted to replace all five
  containers (`Plan: 5 to add, 0 to change, 5 to destroy`) with no change in my
  code:

  ```
  - network_mode = "bridge" -> null # forces replacement
  ```

  Docker assigns `bridge` and the provider stores it in state; my config did
  not set it, so every plan saw a difference that needs a new container. The
  earlier apply that turned on `enable_redlock` had replaced `redis-6379` for
  the same reason, not because of the four new instances. Setting
  `network_mode = "bridge"` explicitly made the next plan say
  `No changes. Your infrastructure matches the configuration.`

- **One edit can fan out across the dependency graph; another touches nothing
  that is running.** Two edits, planned separately:

  ```
  name = "redis:7" -> "redis:7.2"   (on docker_image.redis)
    Plan: 6 to add, 0 to change, 6 to destroy

  restart = "unless-stopped"        (on docker_container.redis)
    Plan: 0 to add, 5 to change, 0 to destroy
  ```

  The image `name` shows `# forces replacement`; the new image ID is "known
  after apply", every container uses that ID, so each container's `image` also
  shows `# forces replacement`: one line changed, twelve actions planned. The
  restart policy is `~` (update in place): same container IDs, nothing
  recreated. I applied the second one as a saved plan
  (`terraform plan -out=tfplan`, then `terraform apply tfplan`):
  `Apply complete! Resources: 0 added, 5 changed, 0 destroyed.`, followed by
  `No changes.` A saved plan applies exactly what I read; a fresh `apply`
  re-plans, and the world can change between the two.

- **Drift: a missing object is a create; a changed attribute that forces
  replacement is a destroy and a create.** After `docker rm -f redis-6381`:

  ```
  terraform plan                -> + create redis["6381"]   (1 to add)
  terraform plan -refresh-only  -> redis["6381"] has been deleted
                                   "Terraform will not take any actions to undo these."
  ```

  After `docker rename redis-6382 redis-6382-old`:

  ```
  terraform plan                -> ~ name = "redis-6382-old" -> "redis-6382" # forces replacement
  terraform plan -refresh-only  -> redis["6382"] has changed:  name "redis-6382" -> "redis-6382-old"
  ```

  A plain `plan` proposes a change to the real world; `-refresh-only` proposes
  only to update the state to match reality. One `terraform apply`
  (`Plan: 2 to add, 0 to change, 1 to destroy`) fixed both: it created a new
  `redis-6381`, destroyed the renamed container, and created a new
  `redis-6382`. `docker ps -a` afterwards showed the two new containers as
  `Up 12 seconds` and the three untouched ones as `Up 33 minutes` — Terraform
  acted only on what differed. Accepting the rename into state would not have
  helped: the config still says `redis-6382`, so the plan would still want a
  replace. To accept reality, the code has to change. And the renamed
  container lost whatever it held when it was replaced.

- **Two applies at once: the second one is refused, or waits.** With a
  `terraform_data` resource whose `local-exec` runs `sleep 20`, a second
  `terraform apply` while the first was busy failed immediately:

  ```
  Error: Error acquiring the state lock
  Error message: resource temporarily unavailable
  Lock Info:
    ID:        cb9a98d4-af4e-c057-acf6-58aac5dc3e00
    Path:      terraform.tfstate
    Operation: OperationTypeApply
    Who:       sachin@MacBook-Pro.local
    Version:   1.16.3
    Created:   2026-10-05 08:48:28.449497 +0000 UTC
  ```

  With `-lock-timeout=60s` it printed `Acquiring state lock. This may take a
  few moments...`, waited for the first apply to finish, then refreshed the
  state — and the id it read (`86b73eca-…`) was the one the first apply had
  just created. Waiting meant it saw the first apply's result instead of
  racing it and overwriting it with an older view: Day 13's lost update, on
  Terraform's own state file.

### Connecting it to Day 13

- **The lock key** is the state file (`terraform.tfstate` here). Each
  acquisition gets a new lock ID, visible in the error.
- **There is no TTL.** The lock is not a timer that can run out while the
  holder is still working, so Day 13's Part 2 failure (two holders at once
  because the lock expired mid-work) can't happen in the same way. On the local
  backend the lock belongs to the running process; the error text
  (`resource temporarily unavailable`) is the operating system's file-lock
  message. A remote backend keeps its lock record until something releases it,
  which is what `terraform force-unlock <lock ID>` is for after a crashed run.
  Terraform trades liveness for safety: no overlapping holders, at the cost of a
  manual unlock when a holder dies. Redis locks trade the other way.
- **Fencing, loosely.** `terraform.tfstate` carries a `lineage` and a
  `serial` (mine is at 46) that only go up on every state write, and
  `terraform state push` is documented to refuse an older serial over a newer
  one — the same idea as Day 13's fencing token, checked by the thing being
  protected.

### Compose vs Terraform for this setup

| | `docker-compose.yml` (Day 13) | Terraform (today) |
| --- | --- | --- |
| Starting five Redis instances | one short file, one command | more files and concepts (provider, state, variables) |
| "What is supposed to exist?" | the file, but it does not track what actually exists | the state file plus a plan that compares both with reality |
| Noticing that someone changed or removed a container | not tracked | `plan` shows it; `-refresh-only` shows only the drift |
| Changing something | edit and `up -d` — what changes is implicit | the plan shows each create/update/replace before anything happens |
| Concurrent operators | nothing | state lock |

For five throwaway Redis instances on a laptop, compose is the simpler tool.
Terraform earns its weight when the thing has to be reviewed, repeated across
environments, or shared by more than one person or pipeline.

## Code walkthrough

- `src/main.tf` — the provider, the two variables (`redis_ports`,
  `enable_redlock`), `docker_image.redis`, `docker_container.redis` (`for_each`
  over the ports, healthcheck, `restart`, `network_mode`), the `redis_urls`
  output, and `terraform_data.slow` (the 20-second lock holder for Part 5).
- `src/terraform.tfvars` — `enable_redlock = true`.
- `src/main.part1.tf.txt` — my original single-container Part 1 version, kept
  for reference (not loaded by Terraform).
- `.gitignore` (this folder) — keeps `.terraform/`, state files and saved
  plans out of git; `.terraform.lock.hcl` stays tracked.

## Gotchas / things that tripped me up

- **The docker provider cannot take an empty string in `command`.** Writing
  `"--save", ""` shows `+ null` in the plan and fails on apply with
  `values for command may not be empty`. Passing two literal quote characters,
  `"\"\""`, works, and Redis treats it as an empty `save` value (persistence
  stays off).
- **`network_mode` forces a replacement on every plan unless you set it** —
  see above. A non-empty plan after a clean apply is a sign the provider keeps
  a value your config does not set.
- **`keep_locally = false` on a shared image fails.** `terraform destroy` tried
  to delete `redis:7` and Docker refused: another container (an old
  hand-started `redis-lock`) was using it. The fix for a shared image is
  `keep_locally = true`, and `terraform state rm docker_image.redis` to make
  Terraform forget the image without touching Docker.
- **A partly failed apply is not rolled back.** The first Part 2 apply created
  the image, then failed on the container; the image stayed in state and the
  retry planned `1 to add`, not `2`.
- **A config mistake is caught before anything changes.** I put `restart` in
  the `docker_image` block; `terraform plan` stopped with `Unsupported
  argument` before touching anything.
- **`apply` takes the lock before it asks "Enter a value:".** My first
  `-lock-timeout=30s` attempt failed, most likely because the first apply sat
  at the confirmation prompt while I typed. Applying a saved plan (no prompt)
  made the lock last only as long as the apply, and the retry with
  `-lock-timeout=60s` worked.
- **`terraform_data.slow` was reported as tainted at the start of the second
  lock experiment** — an earlier run of it had been interrupted or failed, and
  Terraform marks such a resource for replacement. <TODO: remember what you did
  between the two windows.>
- **Predictions.** Part 4: I expected drift 2 to need a destroy (right) and
  drift 1 to be fixed in place (not quite — a missing object is a plain
  create, with nothing to update or destroy). Part 5: I expected an error
  (right), a message about who holds the lock (right) and a timeout (right in
  principle; my first try timed out because the lock was held longer than 30
  seconds). <TODO: add your Part 1-3 predictions and whether each held.>

## What I'd do differently

<TODO: your own words — e.g. move the container resource into a module with a
`moved` block so the plan shows 0 to add / 0 to destroy; adopt the old
`redis-lock` container with an `import` block; compare with a Pulumi
TypeScript version of the same topology; or move the state to a remote backend
with locking and explain what moves off the laptop.>

## Further reading

- https://developer.hashicorp.com/terraform/intro
- https://developer.hashicorp.com/terraform/language/state
- https://developer.hashicorp.com/terraform/language/state/locking
- https://developer.hashicorp.com/terraform/language/modules/develop/refactoring
- https://registry.terraform.io/providers/kreuzwerker/docker/latest/docs
- https://www.pulumi.com/docs/iac/get-started/
