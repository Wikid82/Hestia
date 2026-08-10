import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "@/db";
import { choreCompletions, chores, users } from "@/db/schema";
import { requireActiveUser } from "@/lib/auth/current-user";
import { isChoreDueToday } from "@/lib/chores/recurrence";
import { ChoreForm } from "./chore-form";
import { ChoreRow } from "./chore-row";
import { TodayChore } from "./today-chore";

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export default async function ChoresPage() {
  const { household, user } = await requireActiveUser();

  const [members, allChores] = await Promise.all([
    db.query.users.findMany({
      where: eq(users.householdId, household.id),
      orderBy: (users, { asc }) => [asc(users.createdAt)],
    }),
    db.query.chores.findMany({
      where: eq(chores.householdId, household.id),
      orderBy: (chores, { asc }) => [asc(chores.title)],
    }),
  ]);

  const dueToday = allChores.filter((chore) =>
    isChoreDueToday({
      recurrence: chore.recurrence,
      dueDate: chore.dueDate,
      recurrenceDays: chore.recurrenceDays,
    }),
  );

  const { start, end } = todayRange();
  const completionsToday =
    dueToday.length === 0
      ? []
      : await db.query.choreCompletions.findMany({
          where: and(
            inArray(
              choreCompletions.choreId,
              dueToday.map((chore) => chore.id),
            ),
            gte(choreCompletions.completedAt, start),
            lt(choreCompletions.completedAt, end),
          ),
        });
  const completedChoreIds = new Set(completionsToday.map((c) => c.choreId));

  const membersById = new Map(members.map((m) => [m.id, m]));

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">Today</h1>
        {dueToday.length === 0 ? (
          <p className="text-sm text-muted-foreground">No chores due today.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {dueToday.map((chore) => (
              <TodayChore
                key={chore.id}
                chore={{
                  id: chore.id,
                  title: chore.title,
                  points: chore.points,
                }}
                assignee={
                  chore.assignedToUserId
                    ? membersById.get(chore.assignedToUserId) ?? null
                    : null
                }
                done={completedChoreIds.has(chore.id)}
                canAct={
                  user.role === "admin" || chore.assignedToUserId === user.id
                }
              />
            ))}
          </div>
        )}
      </section>

      {user.role === "admin" && (
        <section className="space-y-4 border-t border-border pt-8">
          <h2 className="text-lg font-semibold">All chores</h2>
          <div className="space-y-2">
            {allChores.map((chore) => (
              <ChoreRow key={chore.id} chore={chore} members={members} />
            ))}
          </div>

          <div className="max-w-md space-y-3 pt-4">
            <h3 className="font-medium">Add a chore</h3>
            <ChoreForm members={members} />
          </div>
        </section>
      )}
    </div>
  );
}
