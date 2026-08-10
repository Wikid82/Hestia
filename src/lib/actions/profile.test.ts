import assert from "node:assert/strict";
import { test } from "vitest";
import { db } from "@/db";
import { households, users } from "@/db/schema";
import { hashSecret } from "@/lib/auth/password";
import { createSession, getProfileSession } from "@/lib/auth/session";
import { switchProfile, switchToPicker } from "./profile.ts";

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

test("switchProfile: redirects to /login with no session", async () => {
  await assert.rejects(
    switchProfile(null, formData({ userId: "u1" })),
    /NEXT_REDIRECT:\/login/,
  );
});

test("switchProfile: rejects an unknown profile", async () => {
  const householdId = crypto.randomUUID();
  await db.insert(households).values({ id: householdId, name: "The Hatfields" });
  await createSession(householdId);

  const result = await switchProfile(null, formData({ userId: "missing" }));
  assert.deepEqual(result, { error: "Profile not found." });
});

test("switchProfile: rejects a profile from a different household", async () => {
  const householdId = crypto.randomUUID();
  const otherHouseholdId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  await db.insert(households).values({ id: householdId, name: "The Hatfields" });
  await db.insert(households).values({ id: otherHouseholdId, name: "Other" });
  await db.insert(users).values({ id: userId, householdId: otherHouseholdId, name: "Kid" });
  await createSession(householdId);

  const result = await switchProfile(null, formData({ userId }));
  assert.deepEqual(result, { error: "Profile not found." });
});

test("switchProfile: rejects a missing/incorrect PIN when one is set", async () => {
  const householdId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  await db.insert(households).values({ id: householdId, name: "The Hatfields" });
  await db.insert(users).values({
    id: userId,
    householdId,
    name: "Kid",
    pinHash: await hashSecret("1234"),
  });
  await createSession(householdId);

  const noPin = await switchProfile(null, formData({ userId }));
  assert.deepEqual(noPin, { error: "Incorrect PIN." });

  const wrongPin = await switchProfile(null, formData({ userId, pin: "0000" }));
  assert.deepEqual(wrongPin, { error: "Incorrect PIN." });
});

test("switchProfile: succeeds with the correct PIN and redirects home", async () => {
  const householdId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  await db.insert(households).values({ id: householdId, name: "The Hatfields" });
  await db.insert(users).values({
    id: userId,
    householdId,
    name: "Kid",
    pinHash: await hashSecret("1234"),
  });
  await createSession(householdId);

  await assert.rejects(
    switchProfile(null, formData({ userId, pin: "1234" })),
    /NEXT_REDIRECT:\//,
  );
  assert.equal((await getProfileSession())?.userId, userId);
});

test("switchProfile: succeeds with no PIN required", async () => {
  const householdId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  await db.insert(households).values({ id: householdId, name: "The Hatfields" });
  await db.insert(users).values({ id: userId, householdId, name: "Kid" });
  await createSession(householdId);

  await assert.rejects(
    switchProfile(null, formData({ userId })),
    /NEXT_REDIRECT:\//,
  );
  assert.equal((await getProfileSession())?.userId, userId);
});

test("switchToPicker: clears the profile session and redirects", async () => {
  const householdId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  await db.insert(households).values({ id: householdId, name: "The Hatfields" });
  await db.insert(users).values({ id: userId, householdId, name: "Kid" });
  await createSession(householdId);
  const { createProfileSession } = await import("@/lib/auth/session");
  await createProfileSession(householdId, userId);

  await assert.rejects(switchToPicker(), /NEXT_REDIRECT:\/switch-profile/);
  assert.equal(await getProfileSession(), null);
});
