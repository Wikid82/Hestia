import Link from "next/link";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { choreCompletions, chores, reminders } from "@/db/schema";
import { requireActiveUser } from "@/lib/auth/current-user";
import { isChoreDueToday } from "@/lib/chores/recurrence";
import { TodayChore } from "./chores/today-chore";
import { ReminderItem } from "./reminders/reminder-item";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export default async function HubPage() {
  const { household, user } = await requireActiveUser();

  const [allChores, allReminders] = await Promise.all([
    db.query.chores.findMany({ where: eq(chores.householdId, household.id) }),
    db.query.reminders.findMany({
      where: eq(reminders.householdId, household.id),
      orderBy: (reminders, { asc }) => [asc(reminders.dueAt)],
    }),
  ]);

  const myChoresToday = allChores.filter(
    (chore) =>
      chore.assignedToUserId === user.id &&
      isChoreDueToday({
        recurrence: chore.recurrence,
        dueDate: chore.dueDate,
        recurrenceDays: chore.recurrenceDays,
      }),
  );

  const { start, end } = todayRange();
  const completionsToday =
    myChoresToday.length === 0
      ? []
      : await db.query.choreCompletions.findMany({
          where: and(
            inArray(
              choreCompletions.choreId,
              myChoresToday.map((c) => c.id),
            ),
            gte(choreCompletions.completedAt, start),
            lt(choreCompletions.completedAt, end),
          ),
        });
  const completedChoreIds = new Set(completionsToday.map((c) => c.choreId));

  const myReminders = allReminders
    .filter((r) => !r.isDone)
    .filter((r) => !r.assignedToUserId || r.assignedToUserId === user.id)
    .slice(0, 5);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold">
          Hi, {user.avatarEmoji} {user.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {user.points} points ·{" "}
          <Link href="/rewards" className="underline">
            see what you can redeem
          </Link>
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-medium">Your chores today</h2>
        {myChoresToday.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing assigned to you today.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {myChoresToday.map((chore) => (
              <TodayChore
                key={chore.id}
                chore={{
                  id: chore.id,
                  title: chore.title,
                  points: chore.points,
                }}
                assignee={{ name: user.name, avatarEmoji: user.avatarEmoji }}
                done={completedChoreIds.has(chore.id)}
                canAct
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-medium">Reminders</h2>
          <Link href="/reminders" className="text-sm text-muted-foreground underline">
            View all
          </Link>
        </div>
        {myReminders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing pending.</p>
        ) : (
          <div className="space-y-2">
            {myReminders.map((reminder) => (
              <ReminderItem
                key={reminder.id}
                reminder={reminder}
                assignee={
                  reminder.assignedToUserId === user.id
                    ? { name: user.name, avatarEmoji: user.avatarEmoji }
                    : null
                }
                canDelete={false}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
