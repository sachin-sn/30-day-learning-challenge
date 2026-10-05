Day 14 of the 30-day challenge: Infrastructure as Code with Terraform. Yesterday's five Redis instances came from a hand-written compose file, and a leftover hand-started container already on port 6379 showed how little a compose file knows about what is actually running. Today I rebuilt them as code and spent the day changing, breaking and racing them.

The best moment was a plan that wouldn't stay empty. Right after a clean apply, `terraform plan` wanted to replace all five containers — 5 to add, 5 to destroy — with nothing changed in my code. The provider was storing a network mode that Docker assigns by default, my config didn't set it, and every plan saw a difference that needs a new container. One explicit line fixed it, and the next plan said "No changes." A plan that is never empty after a successful apply means the tool is tracking something your code doesn't say.

Reading plans before they run made the blast radius visible. Changing an image tag from redis:7 to redis:7.2 planned 12 actions (6 destroyed, 6 created) because every container depends on the image. Adding a restart policy planned 5 in-place updates and nothing recreated.

Then drift. I deleted one container and renamed another outside Terraform. A plain plan proposed changing the real world, while `plan -refresh-only` proposed only updating the state. The deleted one was a simple create; the renamed one forced a destroy and a create, and the renamed container's contents went with it.

The part that connected back to Day 13: two applies at once. The second was refused with a state lock error, and with a lock timeout it waited, then saw the first apply's result instead of overwriting it. Terraform's lock has no TTL, so it avoids the expired-while-working failure I broke on purpose yesterday. It trades some liveness for safety, the opposite of a Redis lock.

Full writeup and real terminal output on the blog: <link>

#30DayChallenge #Terraform #InfrastructureAsCode #DevOps #Docker #Redis #SoftwareEngineering
