import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { listChores } from "@/api/chores";
import { listReminders } from "@/api/reminders";
import { useAuth } from "@/context/AuthContext";
import { TodayChore } from "@/components/TodayChore";
import { ReminderItem } from "@/components/ReminderItem";

export default function HubPage() {
  const { profile } = useAuth();

  const choresQuery = useQuery({ queryKey: ["chores", "today"], queryFn: () => listChores(true) });
  const remindersQuery = useQuery({ queryKey: ["reminders"], queryFn: listReminders });

  if (!profile) return null;

  const myChoresToday = (choresQuery.data?.chores ?? []).filter((c) => c.assignedToUserId === profile.id);
  const myReminders = (remindersQuery.data?.reminders ?? [])
    .filter((r) => !r.isDone)
    .filter((r) => !r.assignedToUserId || r.assignedToUserId === profile.id)
    .slice(0, 5);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-semibold">
          Hi, {profile.avatarEmoji} {profile.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {profile.points} points ·{" "}
          <Link to="/rewards" className="underline">
            see what you can redeem
          </Link>
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-medium">Your chores today</h2>
        {myChoresToday.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing assigned to you today.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {myChoresToday.map((chore) => (
              <TodayChore
                key={chore.id}
                chore={{ id: chore.id, title: chore.title, points: chore.points, completedToday: chore.completedToday }}
                assignee={{ name: profile.name, avatarEmoji: profile.avatarEmoji }}
                canAct
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-medium">Reminders</h2>
          <Link to="/reminders" className="text-sm text-muted-foreground underline">
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
                  reminder.assignedToUserId === profile.id
                    ? { name: profile.name, avatarEmoji: profile.avatarEmoji }
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
