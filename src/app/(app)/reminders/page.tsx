import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reminders, users } from "@/db/schema";
import { requireActiveUser } from "@/lib/auth/current-user";
import { ReminderForm } from "./reminder-form";
import { ReminderItem } from "./reminder-item";

export default async function RemindersPage() {
  const { household, user } = await requireActiveUser();

  const [members, allReminders] = await Promise.all([
    db.query.users.findMany({
      where: eq(users.householdId, household.id),
      orderBy: (users, { asc }) => [asc(users.createdAt)],
    }),
    db.query.reminders.findMany({
      where: eq(reminders.householdId, household.id),
      orderBy: (reminders, { asc }) => [asc(reminders.dueAt)],
    }),
  ]);

  const membersById = new Map(members.map((m) => [m.id, m]));
  const pending = allReminders.filter((r) => !r.isDone);
  const done = allReminders.filter((r) => r.isDone);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Reminders</h1>
        <p className="text-sm text-muted-foreground">
          Quick tasks that don&apos;t need points — trash day, permission
          slips, that kind of thing.
        </p>
      </div>

      <section className="space-y-2">
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing pending.</p>
        ) : (
          pending.map((reminder) => (
            <ReminderItem
              key={reminder.id}
              reminder={reminder}
              assignee={
                reminder.assignedToUserId
                  ? membersById.get(reminder.assignedToUserId) ?? null
                  : null
              }
              canDelete={
                user.role === "admin" || reminder.assignedToUserId === user.id
              }
            />
          ))
        )}
      </section>

      {done.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Done</h2>
          {done.map((reminder) => (
            <ReminderItem
              key={reminder.id}
              reminder={reminder}
              assignee={
                reminder.assignedToUserId
                  ? membersById.get(reminder.assignedToUserId) ?? null
                  : null
              }
              canDelete={
                user.role === "admin" || reminder.assignedToUserId === user.id
              }
            />
          ))}
        </section>
      )}

      <div className="max-w-md space-y-3 border-t border-border pt-6">
        <h2 className="font-medium">Add a reminder</h2>
        <ReminderForm members={members} isAdmin={user.role === "admin"} />
      </div>
    </div>
  );
}
