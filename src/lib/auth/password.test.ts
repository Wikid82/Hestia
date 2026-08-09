import assert from "node:assert/strict";
import { test } from "node:test";
import { hashSecret, verifySecret } from "./password.ts";

test("hashSecret + verifySecret: round-trips the correct secret", async () => {
  const hash = await hashSecret("correct horse battery staple");
  assert.equal(await verifySecret("correct horse battery staple", hash), true);
});

test("verifySecret: rejects an incorrect secret", async () => {
  const hash = await hashSecret("correct horse battery staple");
  assert.equal(await verifySecret("wrong guess", hash), false);
});

test("hashSecret: salts each hash differently, even for the same input", async () => {
  const [a, b] = await Promise.all([
    hashSecret("1234"),
    hashSecret("1234"),
  ]);
  assert.notEqual(a, b);
  assert.equal(await verifySecret("1234", a), true);
  assert.equal(await verifySecret("1234", b), true);
});

test("verifySecret: rejects malformed stored hashes rather than throwing", async () => {
  assert.equal(await verifySecret("1234", ""), false);
  assert.equal(await verifySecret("1234", "not-a-real-hash"), false);
});
