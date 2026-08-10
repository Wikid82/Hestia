import assert from "node:assert/strict";
import { test } from "vitest";
import { db } from "@/db";
import { households } from "@/db/schema";
import { createSession } from "@/lib/auth/session";
import { getThemePreference } from "./theme.ts";

test("getThemePreference: falls back to system with no session", async () => {
  assert.equal(await getThemePreference(), "system");
});

test("getThemePreference: falls back to system when the household is gone", async () => {
  await createSession("missing-household-id");
  assert.equal(await getThemePreference(), "system");
});

test("getThemePreference: returns the household's saved preference", async () => {
  const householdId = crypto.randomUUID();
  await db.insert(households).values({
    id: householdId,
    name: "The Hatfields",
    themePreference: "dark",
  });
  await createSession(householdId);

  assert.equal(await getThemePreference(), "dark");
});
