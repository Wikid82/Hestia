import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { households } from "@/db/schema";
import { getSession } from "@/lib/auth/session";

export type ThemePreference = "system" | "light" | "dark";

// Pre-login pages (login/signup) have no household session yet, so they
// fall back to following the OS preference.
export async function getThemePreference(): Promise<ThemePreference> {
  const session = await getSession();
  if (!session) return "system";

  const household = await db.query.households.findFirst({
    where: eq(households.id, session.householdId),
    columns: { themePreference: true },
  });
  return household?.themePreference ?? "system";
}
