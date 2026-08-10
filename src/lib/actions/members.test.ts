import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { test } from "vitest";
import { db } from "@/db";
import { households, users } from "@/db/schema";
import { createProfileSession, createSession } from "@/lib/auth/session";
import {
  clearMemberPin,
  createMember,
  deleteMember,
  updateMember,
} from "./members.ts";

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

async function seedAdmin() {
  const householdId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  await db.insert(households).values({ id: householdId, name: "The Hatfields" });
  await db.insert(users).values({ id: userId, householdId, name: "Jeremy", role: "admin" });
  await createSession(householdId);
  await createProfileSession(householdId, userId);
  return { householdId, userId };
}

test("createMember: rejects a missing name", async () => {
  await seedAdmin();
  const result = await createMember(null, formData({ name: "  " }));
  assert.deepEqual(result, { error: "Name is required." });
});

test("createMember: rejects a malformed PIN", async () => {
  await seedAdmin();
  const result = await createMember(null, formData({ name: "Kid", pin: "12" }));
  assert.deepEqual(result, { error: "PIN must be 4-6 digits." });
});

test("createMember: creates a member with defaults", async () => {
  const { householdId } = await seedAdmin();
  const result = await createMember(null, formData({ name: "Kid" }));
  assert.equal(result, null);

  const member = await db.query.users.findFirst({
    where: (u, { and, eq }) => and(eq(u.householdId, householdId), eq(u.name, "Kid")),
  });
  assert.equal(member?.role, "member");
  assert.equal(member?.avatarEmoji, "🙂");
  assert.equal(member?.pinHash, null);
});

test("createMember: creates an admin member with a PIN and custom avatar", async () => {
  const { householdId } = await seedAdmin();
  await createMember(
    null,
    formData({ name: "Co-Parent", role: "admin", avatarEmoji: "🦄", pin: "4321" }),
  );

  const member = await db.query.users.findFirst({
    where: (u, { and, eq }) => and(eq(u.householdId, householdId), eq(u.name, "Co-Parent")),
  });
  assert.equal(member?.role, "admin");
  assert.equal(member?.avatarEmoji, "🦄");
  assert.ok(member?.pinHash);
});

test("updateMember: rejects a missing name and a malformed PIN", async () => {
  const { householdId } = await seedAdmin();
  const targetId = crypto.randomUUID();
  await db.insert(users).values({ id: targetId, householdId, name: "Kid" });

  assert.deepEqual(
    await updateMember(null, formData({ id: targetId, name: "" })),
    { error: "Name is required." },
  );
  assert.deepEqual(
    await updateMember(null, formData({ id: targetId, name: "Kid", pin: "abc" })),
    { error: "PIN must be 4-6 digits." },
  );
});

test("updateMember: rejects an unknown profile", async () => {
  await seedAdmin();
  const result = await updateMember(
    null,
    formData({ id: "missing", name: "Kid" }),
  );
  assert.deepEqual(result, { error: "Profile not found." });
});

test("updateMember: updates fields, keeping the PIN when none is provided", async () => {
  const { householdId } = await seedAdmin();
  const targetId = crypto.randomUUID();
  await db.insert(users).values({ id: targetId, householdId, name: "Kid" });

  await updateMember(null, formData({ id: targetId, name: "Updated", pin: "9999" }));
  const withPin = await db.query.users.findFirst({ where: eq(users.id, targetId) });
  assert.ok(withPin?.pinHash);

  await updateMember(null, formData({ id: targetId, name: "Updated Again" }));
  const stillHasPin = await db.query.users.findFirst({ where: eq(users.id, targetId) });
  assert.equal(stillHasPin?.name, "Updated Again");
  assert.equal(stillHasPin?.pinHash, withPin?.pinHash);
});

test("clearMemberPin: no-ops for an unknown profile", async () => {
  await seedAdmin();
  await clearMemberPin(formData({ id: "missing" }));
});

test("clearMemberPin: clears the PIN hash", async () => {
  const { householdId } = await seedAdmin();
  const targetId = crypto.randomUUID();
  await db.insert(users).values({ id: targetId, householdId, name: "Kid", pinHash: "hash" });

  await clearMemberPin(formData({ id: targetId }));
  const member = await db.query.users.findFirst({ where: eq(users.id, targetId) });
  assert.equal(member?.pinHash, null);
});

test("deleteMember: no-ops for an unknown profile", async () => {
  await seedAdmin();
  await deleteMember(formData({ id: "missing" }));
});

test("deleteMember: refuses to delete the main household account", async () => {
  const { householdId } = await seedAdmin();
  const targetId = crypto.randomUUID();
  await db.insert(users).values({
    id: targetId,
    householdId,
    name: "Main",
    email: "main@example.com",
    passwordHash: "hash",
  });

  await assert.rejects(
    deleteMember(formData({ id: targetId })),
    /main household account can't be deleted/,
  );
});

test("deleteMember: deletes a member without a password", async () => {
  const { householdId } = await seedAdmin();
  const targetId = crypto.randomUUID();
  await db.insert(users).values({ id: targetId, householdId, name: "Kid" });

  await deleteMember(formData({ id: targetId }));
  const member = await db.query.users.findFirst({ where: eq(users.id, targetId) });
  assert.equal(member, undefined);
});
