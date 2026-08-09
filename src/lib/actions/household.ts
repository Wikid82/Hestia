"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { households } from "@/db/schema";
import { requireActiveUser, requireAdmin } from "@/lib/auth/current-user";
import type { FormState } from "./form-state";

export async function renameHousehold(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { household, user } = await requireActiveUser();
  requireAdmin(user);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "Household name is required." };
  }

  await db
    .update(households)
    .set({ name })
    .where(eq(households.id, household.id));

  revalidatePath("/household");
  revalidatePath("/");
  revalidatePath("/switch-profile");
  return null;
}
