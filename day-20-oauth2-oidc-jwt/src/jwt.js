import {
  SignJWT,
  jwtVerify,
  decodeJwt,
  decodeProtectedHeader,
  generateKeyPair,
} from "jose";

export const ISSUER = "https://issuer.test";
export const AUDIENCE = "my-api";
export const SUBJECT = "user-123";

// Test secret only. In production this comes from process.env.JWT_SECRET.
export const SECRET = new TextEncoder().encode(
  "your-super-safe-and-secret-key-at-least-32-chars"
);

// ---------- HS256 ----------
export async function signHS256(secret = SECRET) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(SUBJECT)
    .setExpirationTime("5m")
    .sign(secret);
}

// Reused in Part B: returns the payload, or throws.
export async function verifyHS256(token, secret = SECRET) {
  const { payload } = await jwtVerify(token, secret, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ["HS256"],
  });
  return payload;
}

// ---------- RS256 ----------
export async function signRS256(privateKey) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(SUBJECT)
    .setExpirationTime("5m")
    .sign(privateKey);
}

export async function verifyRS256(token, publicKey) {
  const { payload } = await jwtVerify(token, publicKey, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ["RS256"],
  });
  return payload;
}

// ---------- printing ----------
function show(label, token) {
  const [header, payload, signature] = token.split(".");
  console.log(`\n===== ${label} =====`);
  console.log("token:", token);
  console.log("part 1 (header):   ", header);
  console.log("part 2 (payload):  ", payload);
  console.log("part 3 (signature):", signature);
  console.log("decoded header: ", decodeProtectedHeader(token));
  console.log("decoded payload:", decodeJwt(token));
  console.log("signature length:", signature.length);
}

// Run only when started directly (node jwt.js), not when imported by Part B.
if (import.meta.url === `file://${process.argv[1]}`) {
  const hs = await signHS256();
  show("HS256", hs);
  console.log("verified payload:", await verifyHS256(hs));

  const { publicKey, privateKey } = await generateKeyPair("RS256", {
    modulusLength: 2048,
  });
  const rs = await signRS256(privateKey);
  show("RS256 (2048-bit)", rs);
  console.log("verified payload:", await verifyRS256(rs, publicKey));
}
