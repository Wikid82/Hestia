"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { reminders, users } from "@/db/schema";
import { requireActiveUser } from "@/lib/auth/current-user";
import type { FormState } from "./form-state";

function parseDateInput(value: string): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createReminder(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { household, user } = await requireActiveUser();

  const title = String(formData.get("title") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const dueAt = parseDateInput(String(formData.get("dueAt") ?? ""));
  let assignedToUserId = String(formData.get("assignedToUserId") ?? "") || null;

  if (!title) return { error: "Title is required." };

  // Non-admins can only create reminders for themselves or the whole
  // household — not assign work to someone else.
  if (
    user.role !== "admin" &&
    assignedToUserId &&
    assignedToUserId !== user.id
  ) {
    assignedToUserId = user.id;
  }

  if (assignedToUserId) {
    const assignee = await db.query.users.findFirst({
      where: and(
        eq(users.id, assignedToUserId),
        eq(users.householdId, household.id),
      ),
    });
    if (!assignee) return { error: "Assignee not found." };
  }

  await db.insert(reminders).values({
    id: crypto.randomUUID(),
    householdId: household.id,
    title,
    notes: notes || null,
    dueAt,
    assignedToUserId,
  });

  revalidatePath("/reminders");
  revalidatePath("/");
  revalidatePath("/calendar");
  return null;
}

export async function toggleReminderDone(formData: FormData) {
  const { household } = await requireActiveUser();

  const id = String(formData.get("id") ?? "");
  const reminder = await db.query.reminders.findFirst({
    where: and(eq(reminders.id, id), eq(reminders.householdId, household.id)),
  });
  if (!reminder) return;

  await db
    .update(reminders)
    .set({ isDone: !reminder.isDone })
    .where(eq(reminders.id, id));

  revalidatePath("/reminders");
  revalidatePath("/");
  revalidatePath("/calendar");
}

export async function deleteReminder(formData: FormData) {
  const { household, user } = await requireActiveUser();

  const id = String(formData.get("id") ?? "");
  const reminder = await db.query.reminders.findFirst({
    where: and(eq(reminders.id, id), eq(reminders.householdId, household.id)),
  });
  if (!reminder) return;

  if (user.role !== "admin" && reminder.assignedToUserId !== user.id) {
    throw new Error("You can only delete your own reminders.");
  }

  await db.delete(reminders).where(eq(reminders.id, id));

  revalidatePath("/reminders");
  revalidatePath("/");
  revalidatePath("/calendar");
}
