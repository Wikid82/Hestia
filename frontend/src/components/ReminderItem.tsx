import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteReminder, toggleReminderDone } from "@/api/reminders";

type Assignee = { name: string; avatarEmoji: string } | null;

export function ReminderItem({
  reminder,
  assignee,
  canDelete,
}: {
  reminder: { id: string; title: string; notes?: string | null; dueAt?: string | null; isDone: boolean };
  assignee: Assignee;
  canDelete: boolean;
}) {
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: () => toggleReminderDone(reminder.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reminders"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteReminder(reminder.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reminders"] }),
  });

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
      <div className="flex flex-1 gap-2">
        <button
          type="button"
          onClick={() => toggleMutation.mutate()}
          disabled={toggleMutation.isPending}
          aria-label={reminder.isDone ? "Mark not done" : "Mark done"}
          className={`mt-0.5 h-5 w-5 shrink-0 rounded border ${
            reminder.isDone ? "border-primary bg-primary" : "border-border"
          }`}
        />
        <div>
          <p className={reminder.isDone ? "text-muted-foreground line-through" : ""}>{reminder.title}</p>
          {reminder.notes && <p className="text-sm text-muted-foreground">{reminder.notes}</p>}
          <p className="text-xs text-muted-foreground">
            {assignee ? `${assignee.avatarEmoji} ${assignee.name}` : "Everyone"}
            {reminder.dueAt && ` · due ${new Date(reminder.dueAt).toLocaleDateString()}`}
          </p>
        </div>
      </div>

      {canDelete && (
        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="text-sm text-danger hover:text-danger-hover"
        >
          Delete
        </button>
      )}
    </div>
  );
}
