import { deleteReminder, toggleReminderDone } from "@/lib/actions/reminders";

type Assignee = { name: string; avatarEmoji: string } | null;

export function ReminderItem({
  reminder,
  assignee,
  canDelete,
}: {
  reminder: {
    id: string;
    title: string;
    notes: string | null;
    dueAt: Date | null;
    isDone: boolean;
  };
  assignee: Assignee;
  canDelete: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
      <form action={toggleReminderDone} className="flex flex-1 gap-2">
        <input type="hidden" name="id" value={reminder.id} />
        <button
          type="submit"
          aria-label={reminder.isDone ? "Mark not done" : "Mark done"}
          className={`mt-0.5 h-5 w-5 shrink-0 rounded border ${
            reminder.isDone
              ? "border-primary bg-primary"
              : "border-border"
          }`}
        />
        <div>
          <p className={reminder.isDone ? "text-muted-foreground line-through" : ""}>
            {reminder.title}
          </p>
          {reminder.notes && (
            <p className="text-sm text-muted-foreground">{reminder.notes}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {assignee ? `${assignee.avatarEmoji} ${assignee.name}` : "Everyone"}
            {reminder.dueAt &&
              ` · due ${reminder.dueAt.toLocaleDateString()}`}
          </p>
        </div>
      </form>

      {canDelete && (
        <form action={deleteReminder}>
          <input type="hidden" name="id" value={reminder.id} />
          <button className="text-sm text-danger hover:text-danger-hover">
            Delete
          </button>
        </form>
      )}
    </div>
  );
}
