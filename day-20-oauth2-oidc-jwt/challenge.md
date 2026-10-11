# Day 20 — JWT Deep Dive: Sign, Verify, Break

**Time box:** 90 minutes. Part A about 40 min, Part B about 30 min, notes about 15 min.
If a part runs over by 15 minutes, stop, write down where you stopped, and move on.
**Tech stack:** Node.js 22, the `jose` library (JavaScript, ES modules)

## Why this matters

"How do you verify a JWT?" and "what is the difference between HS256 and RS256?" are
standard interview questions. Most real JWT bugs are not in the signing. They are
in what the verifier forgets to check: the algorithm, the audience, the issuer, the
expiry. Today you build a verifier and then try to get five bad tokens past it.

OAuth2 and OIDC sit on top of this. OAuth2 is how a client gets permission to call an
API for a user. OIDC adds an ID token (a JWT) that says who the user is. Today's work
is the JWT part that both depend on.

## Predictions (write these first, 5 min)

Put them in `solution.md` before you write code.

1. A JWT has three parts separated by dots. How many characters will the third part
   (the signature) have for an HS256 token, and for an RS256 token with a 2048-bit key?
   (A number for each; a good guess is fine.)
2. In Part B you send 5 bad tokens to your verifier. How many will be rejected?

## Part A — Build it (about 40 min)

In `src/` (set `"type": "module"` in `package.json`, or use `.mjs` file names), install
`jose`.

1. **HS256.** Make a shared secret (a test value in the code, for example 32 random
   bytes; never a real secret). Sign a token with `issuer`, `audience`, `subject` and a
   5-minute expiry. Verify it with `jwtVerify`, and **pass `issuer`, `audience` and
   `algorithms: ["HS256"]`** in the verify options.
2. **RS256.** Generate a key pair with `generateKeyPair("RS256")`. Sign with the private
   key and verify with the public key, with the same claims and options.
3. For both tokens print: the three parts separated, the decoded header and payload
   (`decodeProtectedHeader`, `decodeJwt`), and the length of the signature part.

Done looks like: both tokens verify and print their claims, and you know the
signature length of each.

## Part B — Measure or break it (about 30 min)

Against your **HS256** verifier, try these five tokens and record what happens to each:

1. An expired token (`exp` in the past)
2. A token with the wrong audience
3. A token signed with a different secret
4. A valid token where you changed the payload (for example the `sub`) by editing the
   middle part and keeping the old signature
5. An unsigned token with the header `{"alg":"none","typ":"JWT"}` (build it by hand: two
   base64url parts and an empty signature)

For each, catch the error and print its name and message.

## Save this output

- The three parts and the signature lengths of the HS256 and RS256 tokens
- A table: bad token, accepted or rejected, error name and message
- One sentence: which of the five would have been accepted if you had not passed
  `algorithms`, `audience` or `issuer` to `jwtVerify`? (Say how you checked, or say
  that you did not check.)

## Not part of today

An OAuth2 server, login screens, refresh tokens, a JWKS endpoint, and key rotation.
Each is a good next step and each takes the whole day.

## Resources

- https://github.com/panva/jose
- https://datatracker.ietf.org/doc/html/rfc7519
