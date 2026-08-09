import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireActiveUser } from "@/lib/auth/current-user";
import { AddMemberForm } from "./add-member-form";
import { HouseholdName } from "./household-name";
import { MemberCard } from "./member-card";

export default async function HouseholdPage() {
  const { household, user } = await requireActiveUser();
  if (user.role !== "admin") {
    redirect("/");
  }

  const members = await db.query.users.findMany({
    where: eq(users.householdId, household.id),
    orderBy: (users, { asc }) => [asc(users.createdAt)],
  });

  return (
    <div className="space-y-8">
      <div>
        <HouseholdName name={household.name} />
        <p className="text-sm text-neutral-500">Manage who&apos;s here.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {members.map((member) => (
          <MemberCard key={member.id} member={member} />
        ))}
      </div>

      <div className="max-w-sm space-y-3 border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <h2 className="font-medium">Add a family member</h2>
        <AddMemberForm />
      </div>
    </div>
  );
}
