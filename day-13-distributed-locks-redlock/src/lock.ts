import { redis } from "./redis";

const LOCK_KEY = "resource_lock";
const TTL = 3000; // Lock timeout in milliseconds (3 seconds)

// Helper function to simulate a delay
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function worker(workerName: string, delayBeforeTry: number) {
  // Wait before trying to simulate competing arrival times
  await sleep(delayBeforeTry);

  // Generate a unique token for this specific worker instance
  const token = `token_${workerName}_${Date.now()}`;

  console.log(`[${workerName}] Attempting to acquire lock...`);

  // Try to acquire the lock
  // NX: Only set the key if it does not already exist
  // PX ttl: Set the specified expire time, in milliseconds
  const result = await redis.call("SET", LOCK_KEY, token, "NX", "PX", TTL);

  if (result === "OK") {
    console.log(
      `[${workerName}] 🟢 Lock ACQUIRED. Operating on critical section...`,
    );

    // Simulate doing work inside the critical section
    await sleep(1500);

    // Release the lock safely using a Lua script to ensure atomicity
    // This prevents a worker from accidentally deleting another worker's lock
    const luaReleaseScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const released = await redis.eval(luaReleaseScript, 1, LOCK_KEY, token);

    if (released === 1) {
      console.log(`[${workerName}] 🔴 Lock RELEASED safely.`);
    } else {
      console.log(
        `[${workerName}] ⚠️ Failed to release lock. It might have expired.`,
      );
    }
  } else {
    console.log(`[${workerName}] ❌ Lock DENIED. Resource is busy.`);
  }
}
