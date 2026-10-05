# Day 14 — Infrastructure as Code with Terraform (Pulumi as the bonus)

**Difficulty:** Intermediate
**Tech stack:** Terraform, Docker (via the `kreuzwerker/docker` provider), Redis 7 (reusing Day 13's five-instance setup); Pulumi (TypeScript) for the bonus round
**Estimated time:** 3-4 hours

## Why this matters

Yesterday's five Redis instances came from a hand-written
`docker-compose.yml`, and the one place it went wrong was exactly the kind
of thing IaC exists for: something was already holding port 6379, a
container failed to start, and the only record of "what is supposed to
exist" was a file that had no idea what actually did. Infrastructure as
Code is the answer to that gap: you describe the end state, a tool
compares it with reality, shows you the difference *before* touching
anything, and then makes reality match. It is also where Day 13 comes
back around — Terraform's state file is shared mutable data that several
people or pipelines may try to change at once, which is a distributed
locking problem in its own right.

You do not need a cloud account today. Terraform's Docker provider
manages containers the same way the AWS provider manages EC2 instances —
resources, dependencies, state, plan, apply, destroy — so everything you
learn transfers, at zero cost and with no credentials to leak.

## Learning objectives

By the end of today you should be able to:

- Explain the Terraform workflow (`init`, `plan`, `apply`, `destroy`) and
  what the state file is for: the mapping between your configuration and
  the real objects it created
- Declare Day 13's five-instance Redis topology as code using variables,
  `for_each`, and outputs, and prove the result works by running Day 13's
  Redlock script against it unchanged
- Read a plan accurately: tell `create` from `update in-place` from
  `destroy and then create (replace)`, and say which attribute changes
  force a replacement and why
- Cause infrastructure drift on purpose, see how Terraform detects it, and
  choose between reconciling reality to the code or the code to reality
- Show state locking in action: a second `apply` refused because the first
  holds the lock — and connect that to what you built on Day 13
- Say what Terraform is *not* good at (secrets in state, long-lived
  imperative steps, anything it can't model as a resource)

## The challenge

Create `src/` in this folder and put the Terraform configuration there.
Everything today should be run, observed, and logged — the plan output is
the evidence, the same way the timestamps were yesterday.

**Part 1 — hello, infrastructure.** Install Terraform (if Homebrew gives
you trouble on your Mac, download the zip for your architecture from
`releases.hashicorp.com` and put the binary on your `PATH`; OpenTofu is a
drop-in alternative). Write `main.tf` with the Docker provider and a
single Redis container (`redis:7`, `--save "" --appendonly no`, port
6379). Before running anything, write down what `terraform plan` will
summarise ("N to add, N to change, N to destroy"). Then `init`, `plan`,
`apply`, confirm `redis-cli -p 6379 ping` answers `PONG`, and inspect the
result with `terraform state list` and `terraform state show`. Free port
6379 first — `docker ps --filter publish=6379` finds whatever is holding
it, and stop any leftover Day 13 containers.

**Part 2 — the whole topology as code.** Replace the single container with
the Day 13 layout: a variable holding the instance ports (`6379`–`6383`)
and a boolean `enable_redlock` that decides whether the extra four exist
(the equivalent of Day 13's compose `redlock` profile). Use `for_each`
over the ports, give each container the same healthcheck as your compose
file, and add an output that lists every instance's connection string.
Predict how many resources `apply` will create with `enable_redlock =
false` and then `true`. Then run Day 13's `npm run part5` against the
containers Terraform made and show it still reports 5/5 reachable — that is
your proof the code describes the same system.

**Part 3 — reading a plan.** Without applying anything, make two small
edits one at a time and run `terraform plan` after each: change one
image tag (`redis:7` to `redis:7.2`), then add a runtime setting to the
container such as `restart = "unless-stopped"` or a memory limit. (Do not
use the port for this: in the `for_each` design the port is the resource
key, so changing it removes one container and adds another instead of
changing an attribute.) For each edit, write down *before* you run the plan
how many resources you expect to change and whether each is an in-place
update or a replace, then check. Save one
of them with `terraform plan -out=tfplan`, apply exactly that file with
`terraform apply tfplan`, and note why applying a saved plan is safer than
re-planning at apply time.

**Part 4 — drift.** Change reality behind Terraform's back, twice:
`docker rm -f redis-6381` (an object disappears), then `docker rename` a
different Terraform-managed container (an attribute changes). After each,
run `terraform plan` and `terraform plan -refresh-only` and record the
difference between them. Predict first what Terraform will propose to do
about the missing container and about the renamed one. Reconcile with
`terraform apply`, and note which of the two drifts was fixed in place and
which required destroying something.

**Part 5 — two applies at once.** Add a `terraform_data` resource with a
`local-exec` provisioner that runs `sleep 20`, so one `apply` stays busy
long enough to overlap. Start an `apply` in one terminal and a second in
another while the first is still sleeping. Capture the lock error, read
the lock info it prints (who holds it, when, which operation), and then
retry the second with `-lock-timeout=30s` and show it waiting instead of
failing. In a paragraph, connect this to Day 13: what is the lock key,
what plays the role of the TTL (and what happens if a process dies while
holding it — find `terraform force-unlock` in the docs), and why a lock
with no fencing is acceptable here but not for the counter in Day 13.

**Part 6 — put it together in solution.md.** Write up what you observed:
the plan/apply/state loop, what each of the three drift and plan
experiments showed, how the lock behaved, and your own account of what
IaC gives you over `docker-compose.yml` today — and where compose was the
simpler tool.

### Requirements

- A Terraform configuration that creates the five-instance Redis topology
  from Day 13, switchable between 1 and 5 instances by a variable
- Day 13's Redlock script run unchanged against Terraform-built instances
- Predictions written before Parts 1, 2, 3 and 4, with whether each held
- Part 3's two plans: an in-place update versus a replace, observed in
  real output and explained
- Part 4's drift shown with both a plain `plan` and `plan -refresh-only`
- Part 5's lock error captured, plus the `-lock-timeout` retry
- `solution.md` written from real output

### Constraints

- No cloud account and no real cloud spend: Docker provider only for the
  core challenge
- Do not use community modules for the core configuration — write the
  resources yourself so you can see every plan line come from your code
- Commit `.terraform.lock.hcl` (it pins provider versions) but never
  `.terraform/`, `terraform.tfstate` or `*.tfstate.backup` — state files
  can contain secrets and machine-specific details, so add them to
  `.gitignore` before the first `apply`
- Always read the plan before applying, and never use `-auto-approve`
  except on `destroy` at the very end

## Bonus round (optional)

- Refactor the container resource into `modules/redis_instance` and use a
  `moved` block so `terraform plan` reports 0 to add and 0 to destroy; then
  remove the `moved` block's protection and show what the same plan says
  without it
- Adopt something Terraform didn't create: start `docker run --name
  redis-adopted -p 6390:6379 redis:7` by hand, write the resource, and
  bring it under management with an `import` block, finishing with an empty
  plan
- Rewrite the same topology in Pulumi using TypeScript (`@pulumi/docker`),
  run it with a local backend, and compare the two: how each handles loops,
  state, previews, and secrets
- Add a remote backend (S3 with a DynamoDB lock table, or Terraform's
  built-in locking where the backend supports it) and explain what moves
  from your laptop into shared infrastructure, referring back to Day 5
- One paragraph: where does IaC stop being the right tool — which parts of
  a system do you still want to configure with something else, and why?

## Resources

- https://developer.hashicorp.com/terraform/intro
- https://developer.hashicorp.com/terraform/language/state
- https://developer.hashicorp.com/terraform/language/state/locking
- https://developer.hashicorp.com/terraform/language/modules/develop/refactoring
- https://registry.terraform.io/providers/kreuzwerker/docker/latest/docs
- https://www.pulumi.com/docs/iac/get-started/

---

Once you've built something, write up `solution.md` in this folder using
`../_template/solution.md` as a starting point.
