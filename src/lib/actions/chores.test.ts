import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { test } from "vitest";
import { db } from "@/db";
import { choreCompletions, chores, households, users } from "@/db/schema";
import { createProfileSession, createSession } from "@/lib/auth/session";
import {
  completeChore,
  createChore,
  deleteChore,
  uncompleteChore,
  updateChore,
} from "./chores.ts";

function formData(fields: Record<string, string | string[]>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const v of value) fd.append(key, v);
    } else {
      fd.set(key, value);
    }
  }
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

function choreForm(overrides: Record<string, string | string[]> = {}) {
  return formData({
    title: "Take out trash",
    points: "5",
    dueDate: "2026-08-12",
    recurrence: "none",
    assignedToUserId: "",
    ...overrides,
  });
}

test("createChore: rejects a missing title", async () => {
  const { userId } = await seedAdmin();
  const result = await createChore(null, choreForm({ title: "  ", assignedToUserId: userId }));
  assert.deepEqual(result, { error: "Title is required." });
});

test("createChore: rejects with no assignee chosen", async () => {
  await seedAdmin();
  const result = await createChore(null, choreForm({ assignedToUserId: "" }));
  assert.deepEqual(result, { error: "Choose who this is assigned to." });
});

test("createChore: rejects negative or non-numeric points", async () => {
  const { userId } = await seedAdmin();
  const result = await createChore(
    null,
    choreForm({ assignedToUserId: userId, points: "-1" }),
  );
  assert.deepEqual(result, { error: "Points must be zero or a positive number." });
});

test("createChore: rejects an invalid due date", async () => {
  const { userId } = await seedAdmin();
  const result = await createChore(
    null,
    choreForm({ assignedToUserId: userId, dueDate: "not-a-date" }),
  );
  assert.deepEqual(result, { error: "Choose a valid due date." });
});

test("createChore: rejects an invalid recurrence", async () => {
  const { userId } = await seedAdmin();
  const result = await createChore(
    null,
    choreForm({ assignedToUserId: userId, recurrence: "monthly" }),
  );
  assert.deepEqual(result, { error: "Invalid recurrence." });
});

test("createChore: rejects custom recurrence with no days picked", async () => {
  const { userId } = await seedAdmin();
  const result = await createChore(
    null,
    choreForm({ assignedToUserId: userId, recurrence: "custom" }),
  );
  assert.deepEqual(result, { error: "Pick at least one day for a custom schedule." });
});

test("createChore: rejects an assignee outside the household", async () => {
  await seedAdmin();
  const result = await createChore(
    null,
    choreForm({ assignedToUserId: "someone-else" }),
  );
  assert.deepEqual(result, { error: "Assignee not found." });
});

test("createChore: creates a custom-recurrence chore", async () => {
  const { householdId, userId } = await seedAdmin();
  const result = await createChore(
    null,
    choreForm({
      assignedToUserId: userId,
      recurrence: "custom",
      recurrenceDays: ["1", "3"],
    }),
  );
  assert.equal(result, null);

  const chore = await db.query.chores.findFirst({
    where: eq(chores.householdId, householdId),
  });
  assert.equal(chore?.recurrence, "custom");
  assert.equal(chore?.recurrenceDays, "[1,3]");
});

test("updateChore: rejects an unknown chore", async () => {
  const { userId } = await seedAdmin();
  const result = await updateChore(
    null,
    choreForm({ id: "missing", assignedToUserId: userId }),
  );
  assert.deepEqual(result, { error: "Chore not found." });
});

test("updateChore: validates fields and assignee, then saves", async () => {
  const { householdId, userId } = await seedAdmin();
  const id = crypto.randomUUID();
  await db.insert(chores).values({
    id,
    householdId,
    title: "Old title",
    assignedToUserId: userId,
    dueDate: new Date("2026-08-12"),
  });

  const badTitle = await updateChore(
    null,
    choreForm({ id, title: "", assignedToUserId: userId }),
  );
  assert.deepEqual(badTitle, { error: "Title is required." });

  const badAssignee = await updateChore(
    null,
    choreForm({ id, assignedToUserId: "nobody" }),
  );
  assert.deepEqual(badAssignee, { error: "Assignee not found." });

  const result = await updateChore(
    null,
    choreForm({ id, title: "New title", assignedToUserId: userId }),
  );
  assert.equal(result, null);
  const chore = await db.query.chores.findFirst({ where: eq(chores.id, id) });
  assert.equal(chore?.title, "New title");
});

test("deleteChore: removes the chore", async () => {
  const { householdId, userId } = await seedAdmin();
  const id = crypto.randomUUID();
  await db.insert(chores).values({
    id,
    householdId,
    title: "Gone soon",
    assignedToUserId: userId,
  });

  await deleteChore(formData({ id }));
  const chore = await db.query.chores.findFirst({ where: eq(chores.id, id) });
  assert.equal(chore, undefined);
});

test("completeChore: no-ops for an unknown or unassigned chore", async () => {
  const { householdId } = await seedAdmin();
  await completeChore(formData({ choreId: "missing" }));

  const unassignedId = crypto.randomUUID();
  await db.insert(chores).values({ id: unassignedId, householdId, title: "Unassigned" });
  await completeChore(formData({ choreId: unassignedId }));

  const stillNoCompletion = await db.query.choreCompletions.findFirst({
    where: eq(choreCompletions.choreId, unassignedId),
  });
  assert.equal(stillNoCompletion, undefined);
});

test("completeChore: a non-admin can't complete someone else's chore", async () => {
  const householdId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const otherId = crypto.randomUUID();
  await db.insert(households).values({ id: householdId, name: "The Hatfields" });
  await db.insert(users).values({ id: memberId, householdId, name: "Kid", role: "member" });
  await db.insert(users).values({ id: otherId, householdId, name: "Sibling", role: "member" });
  await createSession(householdId);
  await createProfileSession(householdId, memberId);

  const choreId = crypto.randomUUID();
  await db.insert(chores).values({ id: choreId, householdId, title: "Not yours", assignedToUserId: otherId });

  await assert.rejects(
    completeChore(formData({ choreId })),
    /isn't assigned to you/,
  );
});

test("completeChore: awards points and is idempotent for the same day", async () => {
  const { householdId, userId } = await seedAdmin();
  const choreId = crypto.randomUUID();
  await db.insert(chores).values({
    id: choreId,
    householdId,
    title: "Dishes",
    points: 5,
    assignedToUserId: userId,
  });

  await completeChore(formData({ choreId }));
  let user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  assert.equal(user?.points, 5);

  // Completing again the same day should be a no-op (already done today).
  await completeChore(formData({ choreId }));
  user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  assert.equal(user?.points, 5);
});

test("uncompleteChore: no-ops for an unknown chore, an unassigned chore, or no completion yet", async () => {
  const { householdId, userId } = await seedAdmin();
  await uncompleteChore(formData({ choreId: "missing" }));

  const unassignedId = crypto.randomUUID();
  await db.insert(chores).values({ id: unassignedId, householdId, title: "Unassigned" });
  await uncompleteChore(formData({ choreId: unassignedId }));

  const choreId = crypto.randomUUID();
  await db.insert(chores).values({ id: choreId, householdId, title: "Never done", assignedToUserId: userId });
  await uncompleteChore(formData({ choreId }));
});

test("uncompleteChore: a non-admin can't uncomplete someone else's chore", async () => {
  const householdId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const otherId = crypto.randomUUID();
  await db.insert(households).values({ id: householdId, name: "The Hatfields" });
  await db.insert(users).values({ id: memberId, householdId, name: "Kid", role: "member" });
  await db.insert(users).values({ id: otherId, householdId, name: "Sibling", role: "member" });
  await createSession(householdId);
  await createProfileSession(householdId, memberId);

  const choreId = crypto.randomUUID();
  await db.insert(chores).values({ id: choreId, householdId, title: "Not yours", assignedToUserId: otherId });

  await assert.rejects(
    uncompleteChore(formData({ choreId })),
    /isn't assigned to you/,
  );
});

test("uncompleteChore: reverses points from a completion made today", async () => {
  const { householdId, userId } = await seedAdmin();
  const choreId = crypto.randomUUID();
  await db.insert(chores).values({
    id: choreId,
    householdId,
    title: "Dishes",
    points: 5,
    assignedToUserId: userId,
  });

  await completeChore(formData({ choreId }));
  await uncompleteChore(formData({ choreId }));

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  assert.equal(user?.points, 0);
  const completion = await db.query.choreCompletions.findFirst({
    where: eq(choreCompletions.choreId, choreId),
  });
  assert.equal(completion, undefined);
});
