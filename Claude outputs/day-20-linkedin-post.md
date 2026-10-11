Day 20 of the 30-day challenge: JWTs. I used the jose library in Node to sign tokens with HS256 and RS256, then sent five broken tokens to a verifier to see what it would do. It is the third day in the shorter 90-minute format, so I only did the tokens, not a full OAuth2 flow.

I made two guesses first. The signature part would be 256 characters, and all five bad tokens would be rejected. The first was wrong for both: the HS256 signature was 43 characters and the RS256 one (2048-bit key) was 342. The second was right. An expired token, a wrong audience, a wrong secret, a changed payload with the old signature and a hand-built "alg: none" token were all rejected, and each error name pointed at the check that caught it.

The result I will remember is what happened when I removed one check at a time. Without the audience check, the token meant for another API was accepted, although its signature, expiry and issuer were fine. Without the issuer check nothing got through, but only because none of my five tokens had a wrong issuer, so I did not really test that one.

I also had a bug that only a review found: I had put the subject in the payload as "subject" instead of the standard "sub" claim.

Five tokens is a small test. I did not try an RS256 token against the HS256 secret, did not check clock tolerance, and have not read what the docs say about the algorithms option. Full writeup on the blog: <link>

#30DayChallenge #JWT #OAuth2 #NodeJS #Security #SoftwareEngineering
