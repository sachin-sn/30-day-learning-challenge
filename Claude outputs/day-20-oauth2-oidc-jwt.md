---
title: "Day 20 — I Guessed 256 Characters. The Signatures Were 43 and 342"
date: "2026-10-11"
excerpt: "I signed JWTs with HS256 and RS256 using the jose library, then sent five broken tokens to a verifier. All five were rejected. Removing one check let one of them through."
tags: ["30-day-challenge", "day-20", "jwt", "oauth2", "oidc", "nodejs", "security"]
draft: true
---

Day 19 was about deciding whether a release should go on. Day 20 is about
deciding whether a request should be let in. I used the `jose` library in Node to
sign JWTs, then tried to break them. This is the third day in the shorter 90-minute
format, so I only did JWTs. I did not run an OAuth2 or OIDC flow.

## The two guesses

Before I wrote code I wrote two predictions. How many characters would the third
part of a token (the signature) have, for HS256 and for RS256 with a 2048-bit key?
I wrote "256", one number for both. And if I sent five bad tokens to my verifier,
how many would be rejected? I wrote "all 5".

## Part A: sign and verify

One function signs an HS256 token with a test secret. It sets `iss`, `aud`, `sub`
and a 5-minute expiry. The verifier checks the issuer, the audience and the
algorithm. A second function does the same with RS256 and a key pair from
`generateKeyPair`.

My first version had a bug I only found in review. I had put `{ subject }` in the
payload, which makes a claim called `subject`. The standard claim is `sub`, and
`.setSubject()` is the way to set it.

```
              header           signature length
HS256         {"alg":"HS256"}  43
RS256 2048    {"alg":"RS256"}  342
```

My 256 was wrong for both. The payload was the same for both tokens:
`iat`, `iss`, `aud`, `sub` and `exp`, where `exp - iat` is 300 seconds. Only the
third part had a different size. 256 is the size in bytes of a 2048-bit RSA
signature, I think, and the token writes those bytes as text, which is longer.
That is my explanation, I did not check it.

## Part B: five bad tokens

All five were rejected, so that prediction was right. What I did not know before is
that the errors tell you which check caught the token.

```
1 expired                         JWTExpired
2 wrong audience                  JWTClaimValidationFailed
3 wrong secret                    JWSSignatureVerificationFailed
4 payload changed, old signature  JWSSignatureVerificationFailed
5 alg none (hand-built)           JOSEAlgNotAllowed
```

Tokens 3 and 4 gave the same error. For the verifier, a token signed with a
different secret and a token whose payload was edited look the same: the signature
does not match. Token 5 never got as far as a signature check, because the
algorithm in the header was not on my list.

## What happens if a check is missing

I ran the same five tokens with one option removed at a time.

```
without audience:    accepted: wrong audience
without issuer:      accepted: none
without algorithms:  accepted: none
no options at all:   accepted: wrong audience
```

Without `audience`, the token meant for another API was accepted. That is the
result I will remember: its signature, its expiry and its issuer were all fine, and
only the audience check stood between it and my API.

The other two lines say less than they look like. Without `issuer`, nothing got
through because none of my five tokens had a wrong issuer, so I did not test that
check at all. Without `algorithms`, the `alg: none` token was still rejected. I did
not look into why.

## What I'm leaving open

I did not test a token with a wrong issuer. I did not test the classic algorithm
confusion case, an RS256 token sent to a verifier that has the HS256 secret. I did
not look at clock tolerance for `exp`. I did not read what the docs say about the
`algorithms` option, so I do not claim a reason for the result above. And there was
no OAuth2 or OIDC flow, only the tokens.

## What's next

Day 21 is next in the plan. Full code in the [repo](#) —
`day-20-oauth2-oidc-jwt/`.
