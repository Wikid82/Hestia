import assert from "node:assert/strict";
import { test } from "vitest";
import { db } from "@/db";
import { households, users } from "@/db/schema";
import { createProfileSession, createSession } from "@/lib/auth/session";
import { requireActiveUser, requireAdmin, requireHousehold } from "./current-user.ts";

async function seedHousehold() {
  const householdId = crypto.randomUUID();
  await db.insert(households).values({ id: householdId, name: "The Hatfields" });
  return householdId;
}

async function seedUser(householdId: string, overrides: Partial<typeof users.$inferInsert> = {}) {
  const userId = crypto.randomUUID();
  await db.insert(users).values({
    id: userId,
    householdId,
    name: "Kid",
    role: "member",
    ...overrides,
  });
  return userId;
}

test("requireHousehold: redirects to /login with no session", async () => {
  await assert.rejects(requireHousehold(), /NEXT_REDIRECT:\/login/);
});

test("requireHousehold: redirects to /login when the household no longer exists", async () => {
  await createSession("missing-household-id");
  await assert.rejects(requireHousehold(), /NEXT_REDIRECT:\/login/);
});

test("requireHousehold: returns the household for a valid session", async () => {
  const householdId = await seedHousehold();
  await createSession(householdId);

  const household = await requireHousehold();
  assert.equal(household.id, householdId);
});

test("requireActiveUser: redirects to /switch-profile with no profile session", async () => {
  const householdId = await seedHousehold();
  await createSession(householdId);

  await assert.rejects(requireActiveUser(), /NEXT_REDIRECT:\/switch-profile/);
});

test("requireActiveUser: redirects to /switch-profile when the profile belongs to another household", async () => {
  const householdId = await seedHousehold();
  const otherHouseholdId = await seedHousehold();
  const userId = await seedUser(otherHouseholdId);
  await createSession(householdId);
  await createProfileSession(otherHouseholdId, userId);

  await assert.rejects(requireActiveUser(), /NEXT_REDIRECT:\/switch-profile/);
});

test("requireActiveUser: redirects to /switch-profile when the user record is gone", async () => {
  const householdId = await seedHousehold();
  await createSession(householdId);
  await createProfileSession(householdId, "missing-user-id");

  await assert.rejects(requireActiveUser(), /NEXT_REDIRECT:\/switch-profile/);
});

test("requireActiveUser: returns household + user for a valid session", async () => {
  const householdId = await seedHousehold();
  const userId = await seedUser(householdId, { name: "Jeremy", role: "admin" });
  await createSession(householdId);
  await createProfileSession(householdId, userId);

  const { household, user } = await requireActiveUser();
  assert.equal(household.id, householdId);
  assert.equal(user.id, userId);
  assert.equal(user.name, "Jeremy");
});

test("requireAdmin: allows an admin profile", () => {
  assert.doesNotThrow(() => requireAdmin({ role: "admin" }));
});

test("requireAdmin: throws for a non-admin profile", () => {
  assert.throws(
    () => requireAdmin({ role: "member" }),
    /requires an admin profile/,
  );
});
