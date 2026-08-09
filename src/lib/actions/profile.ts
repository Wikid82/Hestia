"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifySecret } from "@/lib/auth/password";
import {
  clearProfileSession,
  createProfileSession,
  getSession,
} from "@/lib/auth/session";
import type { FormState } from "./form-state";

export async function switchProfile(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/login");

  const userId = String(formData.get("userId") ?? "");
  const pin = String(formData.get("pin") ?? "");

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  if (!user || user.householdId !== session.householdId) {
    return { error: "Profile not found." };
  }

  if (user.pinHash) {
    if (!pin || !(await verifySecret(pin, user.pinHash))) {
      return { error: "Incorrect PIN." };
    }
  }

  await createProfileSession(session.householdId, user.id);
  redirect("/");
}

export async function switchToPicker() {
  await clearProfileSession();
  redirect("/switch-profile");
}
