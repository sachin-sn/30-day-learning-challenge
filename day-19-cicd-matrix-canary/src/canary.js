// Simulated canary: each request goes to v2 with a 10% chance, else to v1.
// v1 fails 1% of the time, v2 fails 5% of the time.
// Roll back if the v2 error rate is more than 2 percentage points above v1's.
const TOTAL = 100;
const CANARY_SHARE = 0.1;
const FAIL_RATE = { v1: 0.01, v2: 0.05 };
const MAX_EXTRA_POINTS = 2;

const stats = {
  v1: { requests: 0, failures: 0 },
  v2: { requests: 0, failures: 0 },
};

for (let i = 0; i < TOTAL; i++) {
  const version = Math.random() < CANARY_SHARE ? "v2" : "v1";
  stats[version].requests++;
  if (Math.random() < FAIL_RATE[version]) stats[version].failures++;
}

const rate = (s) => (s.requests === 0 ? 0 : (s.failures / s.requests) * 100);

for (const v of ["v1", "v2"]) {
  console.log(
    `${v}: requests=${stats[v].requests} failures=${stats[v].failures} error rate=${rate(stats[v]).toFixed(1)}%`
  );
}

const decision = rate(stats.v2) - rate(stats.v1) > MAX_EXTRA_POINTS ? "ROLLBACK" : "PROMOTE";
console.log(decision);
