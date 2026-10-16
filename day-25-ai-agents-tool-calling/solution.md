# Day 25 — Solution: AI Agent Loop with Tool Calling

> Status: done (optional MAX_STEPS 2 step not done; docs link and the TODOs below still to fill in).

## Predictions (written before the work)

1. How many steps (calls to the model) will task 3 take, counting the final answer?
   Prediction: "5 steps for each so 3X5 total 15 steps" (5 for task 3, and 5 for each of the three tasks; the limit is 5) — result: wrong. Task 3 took 2 steps, not 5. The three tasks took 2 + 3 + 2 = 7 steps in total, not 15, and none came near the limit of 5.
2. After the first error from `count_chars`, will the agent (a) call the same tool again, (b) answer without the tool, or (c) stop and say it failed?
   Prediction: "(b) answer without the tool" — result: right. After the error the agent made no second call to `count_chars`, and answered in the next step.

## Output

Model in `run.js` when I ran it: `claude-opus-5-5`. Max steps 5.

### Part A — `node run.js`

```
=== Task 1: What is the SHA-256 hash of the word 'abc'?
  step 1: hash_text({"input":"abc"}) -> ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
  answer (step 2): The SHA-256 hash of 'abc' is: ba7816bf...0015ad

=== Task 2: Hash the word 'hello', then tell me how many characters the hash has.
  step 1: hash_text({"input":"hello"}) -> 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
  step 2: count_chars({"input":"2cf24dba...9824"}) -> 64
  answer (step 3): the hash, and "It's 64 characters long."

=== Task 3: Hash the words 'a', 'b' and 'c' separately. Which of the three hashes starts with the lowest hex digit?
  step 1: hash_text({"input":"a"}) -> ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb
  step 1: hash_text({"input":"b"}) -> 3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d
  step 1: hash_text({"input":"c"}) -> 2e7d2c03a9507ae265ecf5b5356885a53393a2029d241394997265a1a25aefc6
  answer (step 2): the hash of 'c' starts with the lowest hex digit, 2 (a starts with c, b with 3).

task  failing      steps  tool_calls  in_tok  out_tok  hit_limit
1     -            2      1           1121    110      false
2     -            3      2           1847    219      false
3     -            2      3           1413    266      false
```

Task 3 made all three `hash_text` calls in one step (step 1), then answered in step 2.

### Part B — `node run.js fail` (task 2, `count_chars` fails every time)

```
=== Task 2 (failing on purpose: count_chars)
  step 1: hash_text({"input":"hello"}) -> 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
  step 2: count_chars({"input":"2cf24dba...9824"}) -> ERROR Error: count_chars is temporarily unavailable.
  answer (step 3): the hash, then "It has 64 characters. The character-counting tool wasn't available, so I counted by hand:
  the hash splits into 8 groups of 8. That's also the expected length, since every SHA-256 hash in hex is 64 characters long."

task  failing      steps  tool_calls  in_tok  out_tok  hit_limit
2     count_chars  3      2           1893    390      false
```

The agent did not retry the tool and did not stop. It said the tool was not available and gave 64, which is the same number the working
`count_chars` returned in the normal run (64). Compared with the normal run of task 2: same 3 steps and 2 tool calls, 390 output
tokens instead of 219. The "counted by hand" is the model's own statement; I did not check how it counted.

## What I learned (3 sentences at most)

The three tasks took 2, 3 and 2 steps, far under the limit of 5, because the model asked for all three hashes in one step in task 3. When `count_chars` failed, the agent did not retry or stop: it told me the tool was unavailable and answered anyway, and its 64 matched the working run. The failed run used 390 output tokens against 219 in the normal run.

## Not measured / still open

- The optional run with `MAX_STEPS` 2 was not done, so I did not see what happens when the limit is hit.
- One run per task and one model (`claude-opus-5-5`). I did not repeat the failure run, so I do not know if the agent always answers without the tool, or if it sometimes retries.
- In the failure run the right answer was easy for the model to know without the tool (a SHA-256 hash in hex is always 64 characters). I did not test a tool whose result the model cannot guess.
- I did not try a different model (for example Haiku), a different system prompt, or a tool that fails only once.

## Link

- https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
  Note: Tool result blocks must immediately follow their corresponding tool use blocks in the message history. You cannot include any messages between the assistant's tool use message and the user's tool result message.
