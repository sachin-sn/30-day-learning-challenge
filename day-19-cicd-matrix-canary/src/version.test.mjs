import { test } from "node:test";
import assert from "node:assert/strict";

test("runs on Node 22", () => {
  assert.ok(process.version.startsWith("v22"), process.version);
});
