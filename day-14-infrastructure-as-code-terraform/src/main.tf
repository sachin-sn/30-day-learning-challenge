# Part 2 — Day 13's Redis topology as code.
#
# Prediction (fill in BEFORE running `terraform apply`, starting from an empty state):
#   enable_redlock = false  ->  resources created: ______   (which ones? ______)
#   enable_redlock = true   ->  resources created: ______   (which ones? ______)
#
# Day 13's compose file ran redis-6379 always and redis-6380..6383 only under the
# `redlock` profile; enable_redlock plays the role of that profile.

# Part 4 — Day 13's Redis topology as code.
#
# Prediction:
#   
#   
#

terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0.0"
    }
  }
}

provider "docker" {}

variable "redis_ports" {
  description = "Host ports for the Redis instances, in order. The first one always runs."
  type        = list(number)
  default     = [6379, 6380, 6381, 6382, 6383]
}

variable "enable_redlock" {
  description = "false = only the first instance; true = all of redis_ports (Day 13's `redlock` profile)."
  type        = bool
  default     = false
}

locals {
  active_ports = var.enable_redlock ? var.redis_ports : slice(var.redis_ports, 0, 1)
}

resource "docker_image" "redis" {
  name = "redis:7"

  # true = `terraform destroy` forgets the image but does not delete it from Docker.
  # The image is shared with other containers (Day 13's compose stack, earlier days),
  # and Docker refuses to delete an image that any container still uses.
  keep_locally = true
}

resource "docker_container" "redis" {
  # for_each needs a set/map of strings, so the ports become string keys: "6379", "6380", ...
  for_each = toset([for p in local.active_ports : tostring(p)])

  name  = "redis-${each.key}"
  image = docker_image.redis.image_id
  
  
  restart = "unless-stopped"

  # The provider (v3.0.2) records "bridge" in state even when it isn't set in config, then
  # plans a forced replacement on every run ("network_mode: bridge -> null"). Setting the
  # value Docker picks by default keeps config and state in agreement.
  network_mode = "bridge"

  # The docker provider turns an empty-string element into null and rejects it
  # ("values for command may not be empty"), so the empty --save value is passed as
  # two literal quote characters. Redis parses that as an empty value (save is off).
  command = ["redis-server", "--save", "\"\"", "--appendonly", "no"]

  ports {
    internal = 6379
    external = tonumber(each.key)
  }

  healthcheck {
    test     = ["CMD", "redis-cli", "ping"]
    interval = "5s"
    timeout  = "3s"
    retries  = 5
  }
}

output "redis_urls" {
  description = "Connection string for every running instance."
  value       = [for port, c in docker_container.redis : "redis://127.0.0.1:${port}"]
}

resource "terraform_data" "slow" {
  # Holds the state lock for about 20 seconds, so that a second apply can overlap.
  provisioner "local-exec" {
    command = "sleep 20"
  }
}