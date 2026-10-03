/**
 * One shared Redis connection for every limiter. WHY this matters more
 * today than on Day 4: the entire point of putting rate-limit state in
 * Redis instead of a process-local variable is that it's shared across
 * however many server instances you're running. A counter living in one
 * Node process's memory would let each instance independently allow its
 * own 5 requests — N instances means N times the real limit. Redis is
 * what makes "5 per 10 seconds" actually mean that, globally.
 */
import Redis from "ioredis";

export const redis = new Redis({
  host: process.env.REDIS_HOST ?? "127.0.0.1",
  port: Number(process.env.REDIS_PORT ?? 6379),
});
