# Day 20 — Solution: OAuth2, OIDC and JWT

> Status: done (docs link and one docs sentence still TODO).

## Predictions (written before the work)

1. How many characters will the signature part (the third part) of an HS256 token have, and of an RS256 token with a 2048-bit key?
   Prediction: "256 character" (one number, written for both) — result: wrong for both. HS256 signature: 43 characters. RS256 (2048-bit) signature: 342 characters.
2. You will send 5 bad tokens to your verifier. How many will be rejected?
   Prediction: "all 5 will be rejected" — result: right. 5 of 5 rejected.

## Output

### Part A (real output, tokens shortened)

```
HS256   header {"alg":"HS256"}   signature length: 43
RS256   header {"alg":"RS256"}   signature length: 342

decoded payload (both): { iat: 1791732839, iss: 'https://issuer.test',
  aud: 'my-api', sub: 'user-123', exp: 1791733139 }
exp - iat = 300 s (5 min)
Both tokens verified with issuer + audience + algorithms.
```

Header and payload were identical in length for both tokens except the `alg` value; only the third part differed in size.

### Part B

```
== strict verifier (issuer + audience + algorithms) ==
1 expired                         REJECTED  JWTExpired — "exp" claim timestamp check failed
2 wrong audience                  REJECTED  JWTClaimValidationFailed — unexpected "aud" claim value
3 wrong secret                    REJECTED  JWSSignatureVerificationFailed — signature verification failed
4 payload changed, old signature  REJECTED  JWSSignatureVerificationFailed — signature verification failed
5 alg none (hand-built)           REJECTED  JOSEAlgNotAllowed — "alg" (Algorithm) Header Parameter value not allowed
rejected 5 of 5

== same 5 tokens, one check removed at a time ==
without audience:   accepted 2 wrong audience
without issuer:     accepted none
without algorithms: accepted none
no options at all:  accepted 2 wrong audience
```

## What I learned (3 sentences at most)

An HS256 signature was 43 characters and an RS256 (2048-bit) one was 342, so my 256 was wrong for both. All 5 bad tokens were rejected, and the error name told the cause apart: expired, claim check, and signature (the wrong secret and the changed payload gave the same signature error). Removing `audience` let the wrong-audience token through, and that was the only change in my run.

## Not measured / still open

- "without issuer: accepted none" only means none of my 5 tokens had a wrong issuer. I did not test a wrong-issuer token, so I do not know what that check does here.
- "without algorithms: accepted none": the `alg: none` token was still rejected, but I did not look into why (my guess: HS256 key plus `alg: none` does not match, not checked). I did not test an RS256 token against the HS256 secret (the classic algorithm confusion case).
- I did not check how `exp` clock tolerance works, and I did no OAuth2 or OIDC flow, only JWTs.

## Link

- `jose` `jwtVerify` Note: algorithms for `jose`, it depends on the runtime documents can be found here: https://www.npmjs.com/package/jose
