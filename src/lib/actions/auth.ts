"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { households, users } from "@/db/schema";
import { hashSecret, verifySecret } from "@/lib/auth/password";
import { clearSession, createProfileSession, createSession } from "@/lib/auth/session";
import type { FormState } from "./form-state";

export async function signup(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const householdName = String(formData.get("householdName") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!householdName || !name || !email || !password) {
    return { error: "All fields are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  const householdId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const passwordHash = await hashSecret(password);

  await db.insert(households).values({ id: householdId, name: householdName });
  await db.insert(users).values({
    id: userId,
    householdId,
    name,
    role: "admin",
    email,
    passwordHash,
  });

  await createSession(householdId);
  await createProfileSession(householdId, userId);
  redirect("/");
}

export async function login(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (
    !user ||
    !user.passwordHash ||
    !(await verifySecret(password, user.passwordHash))
  ) {
    return { error: "Invalid email or password." };
  }

  await createSession(user.householdId);
  await createProfileSession(user.householdId, user.id);
  redirect("/");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}
