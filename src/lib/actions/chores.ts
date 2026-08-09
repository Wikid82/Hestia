"use server";

import { and, eq, gte, lt, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { choreCompletions, chores, users } from "@/db/schema";
import { requireActiveUser, requireAdmin } from "@/lib/auth/current-user";
import { serializeRecurrenceDays, type Recurrence } from "@/lib/chores/recurrence";
import type { FormState } from "./form-state";

function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

type ChoreFieldsResult =
  | { error: string }
  | {
      title: string;
      description: string | null;
      points: number;
      assignedToUserId: string;
      recurrence: Recurrence;
      dueDate: Date;
      recurrenceDays: string | null;
    };

function readChoreFields(formData: FormData): ChoreFieldsResult {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const pointsRaw = String(formData.get("points") ?? "0");
  const points = Number.parseInt(pointsRaw, 10);
  const assignedToUserId = String(formData.get("assignedToUserId") ?? "");
  const recurrence = String(formData.get("recurrence") ?? "none") as Recurrence;
  const dueDateRaw = String(formData.get("dueDate") ?? "");
  const recurrenceDayValues = formData.getAll("recurrenceDays").map(String);

  if (!title) return { error: "Title is required." };
  if (!assignedToUserId) return { error: "Choose who this is assigned to." };
  if (!Number.isFinite(points) || points < 0) {
    return { error: "Points must be zero or a positive number." };
  }

  const dueDate = parseDateInput(dueDateRaw);
  if (!dueDate) return { error: "Choose a valid due date." };

  if (
    !["none", "daily", "weekly", "weekdays", "custom"].includes(recurrence)
  ) {
    return { error: "Invalid recurrence." };
  }
  if (recurrence === "custom" && recurrenceDayValues.length === 0) {
    return { error: "Pick at least one day for a custom schedule." };
  }

  return {
    title,
    description: description || null,
    points,
    assignedToUserId,
    recurrence,
    dueDate,
    recurrenceDays:
      recurrence === "custom"
        ? serializeRecurrenceDays(recurrenceDayValues.map(Number))
        : null,
  };
}

export async function createChore(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { household, user } = await requireActiveUser();
  requireAdmin(user);

  const fields = readChoreFields(formData);
  if ("error" in fields) return { error: fields.error };

  const assignee = await db.query.users.findFirst({
    where: and(
      eq(users.id, fields.assignedToUserId),
      eq(users.householdId, household.id),
    ),
  });
  if (!assignee) return { error: "Assignee not found." };

  await db.insert(chores).values({
    id: crypto.randomUUID(),
    householdId: household.id,
    title: fields.title,
    description: fields.description,
    points: fields.points,
    dueDate: fields.dueDate,
    recurrence: fields.recurrence,
    recurrenceDays: fields.recurrenceDays,
    assignedToUserId: fields.assignedToUserId,
  });

  revalidatePath("/chores");
  revalidatePath("/");
  revalidatePath("/calendar");
  return null;
}

export async function updateChore(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { household, user } = await requireActiveUser();
  requireAdmin(user);

  const id = String(formData.get("id") ?? "");
  const existing = await db.query.chores.findFirst({
    where: and(eq(chores.id, id), eq(chores.householdId, household.id)),
  });
  if (!existing) return { error: "Chore not found." };

  const fields = readChoreFields(formData);
  if ("error" in fields) return { error: fields.error };

  const assignee = await db.query.users.findFirst({
    where: and(
      eq(users.id, fields.assignedToUserId),
      eq(users.householdId, household.id),
    ),
  });
  if (!assignee) return { error: "Assignee not found." };

  await db
    .update(chores)
    .set({
      title: fields.title,
      description: fields.description,
      points: fields.points,
      dueDate: fields.dueDate,
      recurrence: fields.recurrence,
      recurrenceDays: fields.recurrenceDays,
      assignedToUserId: fields.assignedToUserId,
    })
    .where(eq(chores.id, id));

  revalidatePath("/chores");
  revalidatePath("/");
  revalidatePath("/calendar");
  return null;
}

export async function deleteChore(formData: FormData) {
  const { household, user } = await requireActiveUser();
  requireAdmin(user);

  const id = String(formData.get("id") ?? "");
  await db
    .delete(chores)
    .where(and(eq(chores.id, id), eq(chores.householdId, household.id)));

  revalidatePath("/chores");
  revalidatePath("/");
  revalidatePath("/calendar");
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function completeChore(formData: FormData) {
  const { household, user } = await requireActiveUser();

  const choreId = String(formData.get("choreId") ?? "");
  const chore = await db.query.chores.findFirst({
    where: and(eq(chores.id, choreId), eq(chores.householdId, household.id)),
  });
  if (!chore) return;

  // Anyone can mark their own chore done; admins can mark on behalf of
  // someone else too (e.g. a parent checking off a younger kid's chore).
  if (chore.assignedToUserId !== user.id && user.role !== "admin") {
    throw new Error("This chore isn't assigned to you.");
  }
  if (!chore.assignedToUserId) return;

  const { start, end } = todayRange();
  const alreadyDoneToday = await db.query.choreCompletions.findFirst({
    where: and(
      eq(choreCompletions.choreId, chore.id),
      gte(choreCompletions.completedAt, start),
      lt(choreCompletions.completedAt, end),
    ),
  });
  if (alreadyDoneToday) return;

  const assignedToUserId = chore.assignedToUserId;

  db.transaction((tx) => {
    tx.insert(choreCompletions)
      .values({
        id: crypto.randomUUID(),
        choreId: chore.id,
        userId: assignedToUserId,
        pointsAwarded: chore.points,
      })
      .run();

    tx.update(users)
      .set({ points: sql`${users.points} + ${chore.points}` })
      .where(eq(users.id, assignedToUserId))
      .run();
  });

  revalidatePath("/chores");
  revalidatePath("/");
  revalidatePath("/calendar");
}

export async function uncompleteChore(formData: FormData) {
  const { household, user } = await requireActiveUser();

  const choreId = String(formData.get("choreId") ?? "");
  const chore = await db.query.chores.findFirst({
    where: and(eq(chores.id, choreId), eq(chores.householdId, household.id)),
  });
  if (!chore || !chore.assignedToUserId) return;

  if (chore.assignedToUserId !== user.id && user.role !== "admin") {
    throw new Error("This chore isn't assigned to you.");
  }

  const { start, end } = todayRange();
  const completion = await db.query.choreCompletions.findFirst({
    where: and(
      eq(choreCompletions.choreId, chore.id),
      gte(choreCompletions.completedAt, start),
      lt(choreCompletions.completedAt, end),
    ),
  });
  if (!completion) return;

  const assignedToUserId = chore.assignedToUserId;

  db.transaction((tx) => {
    tx.delete(choreCompletions)
      .where(eq(choreCompletions.id, completion.id))
      .run();

    tx.update(users)
      .set({ points: sql`${users.points} - ${completion.pointsAwarded}` })
      .where(eq(users.id, assignedToUserId))
      .run();
  });

  revalidatePath("/chores");
  revalidatePath("/");
  revalidatePath("/calendar");
}
