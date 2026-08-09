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
    <div className="flex items-start justify-between gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <form action={toggleReminderDone} className="flex flex-1 gap-2">
        <input type="hidden" name="id" value={reminder.id} />
        <button
          type="submit"
          aria-label={reminder.isDone ? "Mark not done" : "Mark done"}
          className={`mt-0.5 h-5 w-5 shrink-0 rounded border ${
            reminder.isDone
              ? "border-neutral-900 bg-neutral-900 dark:border-white dark:bg-white"
              : "border-neutral-300 dark:border-neutral-700"
          }`}
        />
        <div>
          <p className={reminder.isDone ? "text-neutral-400 line-through" : ""}>
            {reminder.title}
          </p>
          {reminder.notes && (
            <p className="text-sm text-neutral-500">{reminder.notes}</p>
          )}
          <p className="text-xs text-neutral-500">
            {assignee ? `${assignee.avatarEmoji} ${assignee.name}` : "Everyone"}
            {reminder.dueAt &&
              ` · due ${reminder.dueAt.toLocaleDateString()}`}
          </p>
        </div>
      </form>

      {canDelete && (
        <form action={deleteReminder}>
          <input type="hidden" name="id" value={reminder.id} />
          <button className="text-sm text-red-600 hover:text-red-800">
            Delete
          </button>
        </form>
      )}
    </div>
  );
}
