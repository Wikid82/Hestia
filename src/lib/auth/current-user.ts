import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { households, users } from "@/db/schema";
import { getProfileSession, getSession } from "./session";

export async function requireHousehold() {
  const session = await getSession();
  if (!session) redirect("/login");

  const household = await db.query.households.findFirst({
    where: eq(households.id, session.householdId),
  });
  if (!household) redirect("/login");

  return household;
}

export async function requireActiveUser() {
  const household = await requireHousehold();

  const profile = await getProfileSession();
  if (!profile || profile.householdId !== household.id) {
    redirect("/switch-profile");
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, profile.userId),
  });
  if (!user || user.householdId !== household.id) {
    redirect("/switch-profile");
  }

  return { household, user };
}

export function requireAdmin(user: { role: string }) {
  if (user.role !== "admin") {
    throw new Error("This action requires an admin profile.");
  }
}
