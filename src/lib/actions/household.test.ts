import assert from "node:assert/strict";
import { test } from "vitest";
import { db } from "@/db";
import { households, users } from "@/db/schema";
import { createProfileSession, createSession } from "@/lib/auth/session";
import { renameHousehold, updateThemePreference } from "./household.ts";

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

async function seedAdmin() {
  const householdId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  await db.insert(households).values({ id: householdId, name: "The Hatfields" });
  await db.insert(users).values({
    id: userId,
    householdId,
    name: "Jeremy",
    role: "admin",
  });
  await createSession(householdId);
  await createProfileSession(householdId, userId);
  return householdId;
}

test("renameHousehold: requires a non-admin to be rejected", async () => {
  const householdId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  await db.insert(households).values({ id: householdId, name: "The Hatfields" });
  await db.insert(users).values({ id: userId, householdId, name: "Kid", role: "member" });
  await createSession(householdId);
  await createProfileSession(householdId, userId);

  await assert.rejects(
    renameHousehold(null, formData({ name: "New Name" })),
    /requires an admin profile/,
  );
});

test("renameHousehold: rejects an empty name", async () => {
  await seedAdmin();
  const result = await renameHousehold(null, formData({ name: "  " }));
  assert.deepEqual(result, { error: "Household name is required." });
});

test("renameHousehold: updates the household name", async () => {
  const householdId = await seedAdmin();
  const result = await renameHousehold(null, formData({ name: "New Name" }));
  assert.equal(result, null);

  const household = await db.query.households.findFirst({
    where: (h, { eq }) => eq(h.id, householdId),
  });
  assert.equal(household?.name, "New Name");
});

test("updateThemePreference: rejects an invalid value", async () => {
  await seedAdmin();
  const result = await updateThemePreference(
    null,
    formData({ themePreference: "neon" }),
  );
  assert.deepEqual(result, { error: "Invalid theme preference." });
});

test("updateThemePreference: saves a valid preference", async () => {
  const householdId = await seedAdmin();
  const result = await updateThemePreference(
    null,
    formData({ themePreference: "dark" }),
  );
  assert.equal(result, null);

  const household = await db.query.households.findFirst({
    where: (h, { eq }) => eq(h.id, householdId),
  });
  assert.equal(household?.themePreference, "dark");
});
