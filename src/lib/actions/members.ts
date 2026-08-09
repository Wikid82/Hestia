"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireActiveUser, requireAdmin } from "@/lib/auth/current-user";
import { hashSecret } from "@/lib/auth/password";
import type { FormState } from "./form-state";

const DEFAULT_AVATAR = "🙂";

export async function createMember(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { household, user } = await requireActiveUser();
  requireAdmin(user);

  const name = String(formData.get("name") ?? "").trim();
  const role = formData.get("role") === "admin" ? "admin" : "member";
  const avatarEmoji =
    String(formData.get("avatarEmoji") ?? "").trim() || DEFAULT_AVATAR;
  const pin = String(formData.get("pin") ?? "").trim();

  if (!name) {
    return { error: "Name is required." };
  }
  if (pin && !/^\d{4,6}$/.test(pin)) {
    return { error: "PIN must be 4-6 digits." };
  }

  await db.insert(users).values({
    id: crypto.randomUUID(),
    householdId: household.id,
    name,
    role,
    avatarEmoji,
    pinHash: pin ? await hashSecret(pin) : null,
  });

  revalidatePath("/household");
  revalidatePath("/switch-profile");
  return null;
}

export async function updateMember(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { household, user } = await requireActiveUser();
  requireAdmin(user);

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const role = formData.get("role") === "admin" ? "admin" : "member";
  const avatarEmoji =
    String(formData.get("avatarEmoji") ?? "").trim() || DEFAULT_AVATAR;
  const pin = String(formData.get("pin") ?? "").trim();

  if (!name) {
    return { error: "Name is required." };
  }
  if (pin && !/^\d{4,6}$/.test(pin)) {
    return { error: "PIN must be 4-6 digits." };
  }

  const target = await db.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.householdId, household.id)),
  });
  if (!target) {
    return { error: "Profile not found." };
  }

  await db
    .update(users)
    .set({
      name,
      role,
      avatarEmoji,
      ...(pin ? { pinHash: await hashSecret(pin) } : {}),
    })
    .where(eq(users.id, id));

  revalidatePath("/household");
  revalidatePath("/switch-profile");
  return null;
}

export async function clearMemberPin(formData: FormData) {
  const { household, user } = await requireActiveUser();
  requireAdmin(user);

  const id = String(formData.get("id") ?? "");
  const target = await db.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.householdId, household.id)),
  });
  if (!target) return;

  await db.update(users).set({ pinHash: null }).where(eq(users.id, id));
  revalidatePath("/household");
}

export async function deleteMember(formData: FormData) {
  const { household, user } = await requireActiveUser();
  requireAdmin(user);

  const id = String(formData.get("id") ?? "");
  const target = await db.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.householdId, household.id)),
  });
  if (!target) return;

  // The main login account (email/passwordHash set) is how anyone gets into
  // this household at all — deleting it would lock the household out.
  if (target.passwordHash) {
    throw new Error("The main household account can't be deleted.");
  }

  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/household");
  revalidatePath("/switch-profile");
}
