---
title: "Day 14 — The Plan That Wouldn't Stay Empty"
date: "2026-10-05"
excerpt: "Rebuilt Day 13's five Redis instances as Terraform code, then changed, broke and raced them. The most useful moment of the day was a plan that kept wanting to replace everything right after a successful apply."
tags: ["30-day-challenge", "day-14", "terraform", "infrastructure-as-code", "docker", "redis", "devops"]
draft: true
---

Day 13 ended with a small failure that was really an infrastructure
problem: five Redis instances from a hand-written `docker-compose.yml`,
and the one that went wrong was port 6379, already published by a
leftover container I had started by hand. The file said what should exist. It
had no idea what actually did. Infrastructure as Code is the answer to
that gap — you describe the end state, a tool compares it with reality,
shows you the difference before it touches anything, and then makes
reality match. Today I did it with Terraform and its Docker provider, so
everything I learned (resources, state, plan, drift, locking) is the same
as it would be on AWS, with no account, no bill and no credentials to leak.

## One container, then the whole topology

Part 1 was a single Redis container: `terraform init`, `plan` (1 to add),
`apply`, `docker exec … redis-cli ping` answering `PONG`, and
`terraform state show` listing every attribute Docker had filled in —
hostname, an IP on the default bridge network, a working directory — that
the plan had only called "known after apply."

Part 2 turned it into Day 13's layout: a list of ports, a boolean
`enable_redlock` that plays the part of the compose profile, `for_each`
over the ports, a healthcheck, and an output with every connection string.
With the switch on, `docker ps` showed five healthy containers, and then
the real test: I ran Day 13's Redlock script against them, unchanged.

```
Reachable instances: 5/5  [6379, 6380, 6381, 6382, 6383]  (quorum = 3)
  5/5 votes (need 3) ... -> A HOLDS the lock
```

Same votes as yesterday, from infrastructure I never started by hand.

## The plan that would not stay empty

After a successful apply, the next `terraform plan` should say "No
changes." Mine said this:

```
- network_mode = "bridge" -> null # forces replacement
Plan: 5 to add, 0 to change, 5 to destroy.
```

Nothing in my code had changed. Docker assigns `bridge` as the default
network mode and the provider stores it in state; my config never set it,
so every plan saw a difference that can only be fixed by a new container.
It had also quietly replaced `redis-6379` during the apply that switched
on the other four — I had assumed that was the new instances' doing. It
wasn't. Setting `network_mode = "bridge"` explicitly made the config say
what Docker already did, and the next plan read: `No changes. Your
infrastructure matches the configuration.` A plan that is never empty
after a clean apply is the signal that the provider is tracking a value
your code doesn't set.

## Reading a plan before it happens

Two edits, planned one at a time and never applied blind. Changing the
image tag from `redis:7` to `redis:7.2`:

```
Plan: 6 to add, 0 to change, 6 to destroy.
```

One line edited, twelve actions planned: the image name forces a
replacement of the image, the new image's ID is unknown until it exists,
and every container uses that ID, so each one shows `# forces
replacement` too. Adding `restart = "unless-stopped"` to the container:

```
Plan: 0 to add, 5 to change, 0 to destroy.
```

That one is `~`, update in place — same container IDs, nothing recreated.
I applied it as a saved plan (`terraform plan -out=tfplan`, then
`terraform apply tfplan`): exactly what I had read, nothing planned again
in between, and the plan after it was empty.

## Drift: two ways to disagree with Terraform

Behind Terraform's back, I removed one container and renamed another.

```
docker rm -f redis-6381
  plan                -> + create redis["6381"]
  plan -refresh-only  -> redis["6381"] has been deleted

docker rename redis-6382 redis-6382-old
  plan                -> ~ name = "redis-6382-old" -> "redis-6382" # forces replacement
  plan -refresh-only  -> redis["6382"] has changed
```

The two commands answer different questions. A plain `plan` proposes a
change to the real world; `-refresh-only` proposes only to update the
state to match reality, and says outright that it will take no action to
undo anything. A deleted container can't be updated, so it's a plain
create. A renamed one forces a replacement, so it's a destroy followed by
a create. One apply fixed both — `2 to add, 0 to change, 1 to destroy` —
and `docker ps -a` afterward showed the two new containers at "Up 12
seconds" and the other three at "Up 33 minutes." Terraform acted only on
what differed. It also means the renamed container's contents went with
it. Accepting the rename into state wouldn't have helped either: the code
still says `redis-6382`, so the plan would still want a replace. To accept
reality, you change the code.

## Two applies at once

The part that connected back to Day 13. I added a resource whose only job
is `sleep 20`, so an apply stays busy long enough to overlap, and started a
second `apply` while the first was running:

```
Error: Error acquiring the state lock
Lock Info:
  ID:        cb9a98d4-af4e-c057-acf6-58aac5dc3e00
  Path:      terraform.tfstate
  Operation: OperationTypeApply
  Who:       sachin@MacBook-Pro.local
```

Terraform's state is shared mutable data, and a state lock is a
distributed lock in everything but scale. With `-lock-timeout=60s` the
second apply printed `Acquiring state lock…`, waited, then refreshed the
state — and the ID it read was the one the first apply had just created. It
saw the first apply's result instead of racing it, which is Day 13's lost
update, prevented on Terraform's own state file.

The comparison with Day 13 is the useful part. This lock has no TTL, so
the failure that bit me on Day 13 — a lock expiring while its holder is
still working — doesn't happen the same way. On the local backend the lock
belongs to the running process; with a remote backend, a crashed run can
leave a lock behind and `terraform force-unlock` exists for exactly that.
Terraform gives up some liveness to keep safety. A Redis lock gives up
safety to keep liveness. Same trade, opposite sides. And the state file
carries a `serial` (mine reached 46) that only goes up — which looks a lot
like a fencing token checked by the thing being protected.

One small gotcha: my first `-lock-timeout=30s` attempt failed, most likely
because `apply` takes the lock before it asks "Enter a value:", so it was
held while I was still typing `yes`. Applying a saved plan has no prompt,
and the lock lasted only as long as the apply.

## Would I use it for this?

For five throwaway Redis containers on a laptop, no — the compose file is
shorter and does the job. Terraform started paying for its extra moving
parts around the third thing: seeing a change before it happens, noticing
that someone changed or removed something by hand, and being refused when
two operators collide. Those matter as soon as the infrastructure has to be
reviewed, repeated across environments, or touched by more than one person
or pipeline.

## What's next

Day 15 compares Lambda, Cloud Functions and Cloudflare Workers — three
ways of running the same small function, and the trade-offs between them.
Full code in the [repo](#) — `day-14-infrastructure-as-code-terraform/`.
