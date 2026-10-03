/**
 * Shared by demo-fixed-window-burst.ts and demo-sliding-window-burst.ts
 * so both Part 1 and Part 2 run the literal same burst pattern against
 * their own limiter — same timing, same key shape, same limit — and the
 * comparison between the two results is honest rather than two
 * independently-tuned tests that merely look similar.
 *
 * The pattern: wait until shortly before the next 10-second boundary,
 * fire LIMIT requests, then wait until shortly after that boundary and
 * fire LIMIT more. A fixed window treats those as two separate windows
 * (so all of them should pass); a sliding window treats them as one
 * 10-second-wide view of recent history (so only LIMIT total should
 * pass, regardless of which side of the boundary they fell on).
 */
export const WINDOW_SECONDS = 10;
export const LIMIT = 5;

function msUntilNextBoundary(windowSeconds: number): number {
  const windowMs = windowSeconds * 1000;
  const now = Date.now();
  const nextBoundary = Math.ceil(now / windowMs) * windowMs;
  return nextBoundary - now;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ts(): string {
  return new Date().toISOString().slice(11, 23);
}

export async function runBoundaryBurst(
  label: string,
  checkFn: (key: string) => Promise<{ allowed: boolean }>,
  key: string,
): Promise<void> {
  // Line up so the first batch lands ~300ms before the boundary and the
  // second batch ~300ms after it — close enough to be "the same burst,"
  // far enough apart that each batch's own requests don't straddle a
  // boundary themselves.
  let wait = msUntilNextBoundary(WINDOW_SECONDS) - 300;
  if (wait < 0) wait += WINDOW_SECONDS * 1000;

  console.log(`[${label}] waiting ${wait}ms for a window boundary at ~${ts()}...`);
  await sleep(wait);

  let allowedCount = 0;

  console.log(`[${label}] --- batch A (just before the boundary) ---`);
  for (let i = 1; i <= LIMIT; i++) {
    const result = await checkFn(key);
    if (result.allowed) allowedCount++;
    console.log(`[${label}] ${ts()} request A${i} -> ${result.allowed ? "ALLOWED" : "DENIED"}`);
  }

  await sleep(600); // carries us past the boundary

  console.log(`[${label}] --- batch B (just after the boundary) ---`);
  for (let i = 1; i <= LIMIT; i++) {
    const result = await checkFn(key);
    if (result.allowed) allowedCount++;
    console.log(`[${label}] ${ts()} request B${i} -> ${result.allowed ? "ALLOWED" : "DENIED"}`);
  }

  console.log(
    `[${label}] RESULT: ${allowedCount}/${2 * LIMIT} requests allowed within ~1.2s, ` +
      `against a configured limit of ${LIMIT} per ${WINDOW_SECONDS}s`,
  );
}
