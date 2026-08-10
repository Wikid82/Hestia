import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireHousehold } from "@/lib/auth/current-user";
import { ProfilePicker } from "./profile-picker";

export default async function SwitchProfilePage() {
  const household = await requireHousehold();

  const members = await db.query.users.findMany({
    where: eq(users.householdId, household.id),
    orderBy: (users, { asc }) => [asc(users.createdAt)],
  });

  const profiles = members.map((member) => ({
    id: member.id,
    name: member.name,
    avatarEmoji: member.avatarEmoji,
    role: member.role,
    hasPin: Boolean(member.pinHash),
  }));

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">{household.name}</h1>
        <p className="text-sm text-muted-foreground">Who&apos;s doing chores?</p>
      </div>
      <ProfilePicker profiles={profiles} />
    </main>
  );
}
