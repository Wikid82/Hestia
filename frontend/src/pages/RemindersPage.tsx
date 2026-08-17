import { useQuery } from "@tanstack/react-query";
import { listReminders } from "@/api/reminders";
import { listMembers } from "@/api/members";
import { useAuth } from "@/context/AuthContext";
import { ReminderItem } from "@/components/ReminderItem";
import { ReminderForm } from "@/components/ReminderForm";

export default function RemindersPage() {
  const { profile } = useAuth();
  const membersQuery = useQuery({ queryKey: ["members"], queryFn: listMembers });
  const remindersQuery = useQuery({ queryKey: ["reminders"], queryFn: listReminders });

  if (!profile) return null;

  const members = membersQuery.data?.members ?? [];
  const membersById = new Map(members.map((m) => [m.id, m]));
  const allReminders = remindersQuery.data?.reminders ?? [];
  const pending = allReminders.filter((r) => !r.isDone);
  const done = allReminders.filter((r) => r.isDone);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Reminders</h1>
        <p className="text-sm text-muted-foreground">
          Quick tasks that don&apos;t need points — trash day, permission slips, that kind of thing.
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
              assignee={reminder.assignedToUserId ? membersById.get(reminder.assignedToUserId) ?? null : null}
              canDelete={profile.role === "hoh" || reminder.assignedToUserId === profile.id}
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
              assignee={reminder.assignedToUserId ? membersById.get(reminder.assignedToUserId) ?? null : null}
              canDelete={profile.role === "hoh" || reminder.assignedToUserId === profile.id}
            />
          ))}
        </section>
      )}

      <div className="max-w-md space-y-3 border-t border-border pt-6">
        <h2 className="font-medium">Add a reminder</h2>
        <ReminderForm members={members} isAdmin={profile.role === "hoh"} />
      </div>
    </div>
  );
}
