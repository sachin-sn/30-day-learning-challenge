import { test } from "node:test";
import assert from "node:assert/strict"; //
import { add } from "./add.js";

test("should correctly add two numbers", () => {
  assert.strictEqual(add(2, 3), 5);
});

// Subtest grouping structure
test("Math operations suite", async (t) => {
  await t.test("addition subtest", () => {
    assert.strictEqual(add(1, 1), 2);
  });
});
