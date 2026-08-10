import assert from "node:assert/strict";
import { test, vi } from "vitest";
import {
  clearProfileSession,
  clearSession,
  createProfileSession,
  createSession,
  getProfileSession,
  getSession,
} from "./session.ts";

test("getSession: null with no cookie set", async () => {
  assert.equal(await getSession(), null);
});

test("createSession + getSession: round-trips the household id", async () => {
  await createSession("household-1");
  assert.equal((await getSession())?.householdId, "household-1");
});

test("getProfileSession: null with no cookie set", async () => {
  assert.equal(await getProfileSession(), null);
});

test("createProfileSession + getProfileSession: round-trips household + user id", async () => {
  await createProfileSession("household-1", "user-1");
  const profile = await getProfileSession();
  assert.equal(profile?.householdId, "household-1");
  assert.equal(profile?.userId, "user-1");
});

test("clearProfileSession: removes only the profile cookie", async () => {
  await createSession("household-1");
  await createProfileSession("household-1", "user-1");

  await clearProfileSession();

  assert.equal(await getProfileSession(), null);
  assert.equal((await getSession())?.householdId, "household-1");
});

test("clearSession: removes both session and profile cookies", async () => {
  await createSession("household-1");
  await createProfileSession("household-1", "user-1");

  await clearSession();

  assert.equal(await getSession(), null);
  assert.equal(await getProfileSession(), null);
});

test("getSession: null for a garbage cookie value", async () => {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set("hestia_session", "not-a-real-jwt", {});

  assert.equal(await getSession(), null);
});

test("createSession: throws when AUTH_SECRET is not configured", async () => {
  vi.stubEnv("AUTH_SECRET", "");
  await assert.rejects(createSession("household-1"), /AUTH_SECRET/);
  vi.unstubAllEnvs();
});
