import { SignJWT, jwtVerify } from "jose";
import {
  ISSUER, AUDIENCE, SUBJECT, SECRET,
  signHS256, verifyHS256,
} from "./jwt.js";

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
const now = () => Math.floor(Date.now() / 1000);

// One helper to sign HS256 tokens with chosen claims/secret.
function sign({ aud = AUDIENCE, exp = "5m", secret = SECRET } = {}) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(aud)
    .setSubject(SUBJECT)
    .setExpirationTime(exp)
    .sign(secret);
}

// ---------- build the 5 bad tokens ----------
const good = await signHS256();
const [h, p, s] = good.split(".");

// 4. change the payload (sub -> admin), keep the old header and signature
const claims = JSON.parse(Buffer.from(p, "base64url").toString());
const tamperedPayload = b64url({ ...claims, sub: "admin" });

const badTokens = [
  { name: "1 expired", token: await sign({ exp: now() - 60 }) },
  { name: "2 wrong audience", token: await sign({ aud: "other-api" }) },
  {
    name: "3 wrong secret",
    token: await sign({ secret: new TextEncoder().encode("a-different-secret-also-32-chars-long!!") }),
  },
  { name: "4 payload changed, old signature", token: `${h}.${tamperedPayload}.${s}` },
  {
    name: "5 alg none (hand-built)",
    token: `${b64url({ alg: "none" })}.${p}.`,
  },
];

// ---------- run them through the strict verifier ----------
console.log("== strict verifier (issuer + audience + algorithms) ==");
let rejected = 0;
for (const { name, token } of badTokens) {
  try {
    await verifyHS256(token);
    console.log(`${name}: ACCEPTED`);
  } catch (err) {
    rejected++;
    console.log(`${name}: REJECTED  ${err.name} (${err.code ?? "no code"}) — ${err.message}`);
  }
}
console.log(`rejected ${rejected} of ${badTokens.length}`);

// ---------- what if the checks are left out? ----------
console.log("\n== same 5 tokens, one check removed at a time ==");
const variants = {
  "without audience": { issuer: ISSUER, algorithms: ["HS256"] },
  "without issuer": { audience: AUDIENCE, algorithms: ["HS256"] },
  "without algorithms": { issuer: ISSUER, audience: AUDIENCE },
  "no options at all": {},
};
for (const [label, options] of Object.entries(variants)) {
  const accepted = [];
  for (const { name, token } of badTokens) {
    try {
      await jwtVerify(token, SECRET, options);
      accepted.push(name);
    } catch {}
  }
  console.log(`${label}: accepted ${accepted.length ? accepted.join(" | ") : "none"}`);
}
