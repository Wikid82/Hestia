import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { test } from "vitest";
import { db } from "@/db";
import { households, reminders, users } from "@/db/schema";
import { createProfileSession, createSession } from "@/lib/auth/session";
import { createReminder, deleteReminder, toggleReminderDone } from "./reminders.ts";

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

async function seed(role: "admin" | "member" = "admin") {
  const householdId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  await db.insert(households).values({ id: householdId, name: "The Hatfields" });
  await db.insert(users).values({ id: userId, householdId, name: "Jeremy", role });
  await createSession(householdId);
  await createProfileSession(householdId, userId);
  return { householdId, userId };
}

test("createReminder: rejects a missing title", async () => {
  await seed();
  const result = await createReminder(null, formData({ title: "  " }));
  assert.deepEqual(result, { error: "Title is required." });
});

test("createReminder: rejects an unknown assignee", async () => {
  await seed();
  const result = await createReminder(
    null,
    formData({ title: "Trash day", assignedToUserId: "missing" }),
  );
  assert.deepEqual(result, { error: "Assignee not found." });
});

test("createReminder: a non-admin can't assign to someone else", async () => {
  const { householdId, userId } = await seed("member");
  const otherId = crypto.randomUUID();
  await db.insert(users).values({ id: otherId, householdId, name: "Other" });

  await createReminder(
    null,
    formData({ title: "Trash day", assignedToUserId: otherId }),
  );

  const reminder = await db.query.reminders.findFirst({
    where: eq(reminders.title, "Trash day"),
  });
  assert.equal(reminder?.assignedToUserId, userId);
});

test("createReminder: creates an unassigned household reminder with a due date", async () => {
  const { householdId } = await seed();
  const result = await createReminder(
    null,
    formData({ title: "Trash day", notes: "Bins out by 7am", dueAt: "2026-08-20" }),
  );
  assert.equal(result, null);

  const reminder = await db.query.reminders.findFirst({
    where: eq(reminders.householdId, householdId),
  });
  assert.equal(reminder?.title, "Trash day");
  assert.equal(reminder?.notes, "Bins out by 7am");
  assert.equal(reminder?.assignedToUserId, null);
  assert.ok(reminder?.dueAt);
});

test("createReminder: ignores an unparseable due date", async () => {
  await seed();
  await createReminder(null, formData({ title: "No date", dueAt: "not-a-date" }));

  const reminder = await db.query.reminders.findFirst({
    where: eq(reminders.title, "No date"),
  });
  assert.equal(reminder?.dueAt, null);
});

test("toggleReminderDone: no-ops for an unknown reminder", async () => {
  await seed();
  await toggleReminderDone(formData({ id: "missing" }));
});

test("toggleReminderDone: flips isDone", async () => {
  const { householdId } = await seed();
  const id = crypto.randomUUID();
  await db.insert(reminders).values({ id, householdId, title: "Trash day" });

  await toggleReminderDone(formData({ id }));
  let reminder = await db.query.reminders.findFirst({ where: eq(reminders.id, id) });
  assert.equal(reminder?.isDone, true);

  await toggleReminderDone(formData({ id }));
  reminder = await db.query.reminders.findFirst({ where: eq(reminders.id, id) });
  assert.equal(reminder?.isDone, false);
});

test("deleteReminder: no-ops for an unknown reminder", async () => {
  await seed();
  await deleteReminder(formData({ id: "missing" }));
});

test("deleteReminder: a non-admin can't delete someone else's reminder", async () => {
  const { householdId } = await seed("member");
  const otherId = crypto.randomUUID();
  await db.insert(users).values({ id: otherId, householdId, name: "Other" });
  const id = crypto.randomUUID();
  await db.insert(reminders).values({
    id,
    householdId,
    title: "Not yours",
    assignedToUserId: otherId,
  });

  await assert.rejects(
    deleteReminder(formData({ id })),
    /only delete your own reminders/,
  );
});

test("deleteReminder: deletes an owned reminder", async () => {
  const { householdId, userId } = await seed("member");
  const id = crypto.randomUUID();
  await db.insert(reminders).values({
    id,
    householdId,
    title: "Mine",
    assignedToUserId: userId,
  });

  await deleteReminder(formData({ id }));
  const reminder = await db.query.reminders.findFirst({ where: eq(reminders.id, id) });
  assert.equal(reminder, undefined);
});
