import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteChore, updateChore } from "@/api/chores";
import { ApiError } from "@/api/client";
import type { Chore, Profile } from "@/types";
import { describeRecurrence, parseDueDate } from "@/utils/recurrence";
import { ChoreFields, defaultChoreFieldsValue, type ChoreFieldsValue } from "./ChoreFields";

export function ChoreRow({ chore, members }: { chore: Chore; members: Profile[] }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<ChoreFieldsValue>(() => defaultChoreFieldsValue(chore));
  const [error, setError] = useState<string | null>(null);
  const assignee = members.find((m) => m.id === chore.assignedToUserId);

  const updateMutation = useMutation({
    mutationFn: () =>
      updateChore(chore.id, {
        title: value.title,
        description: value.description || null,
        points: value.points,
        assignedToUserId: value.assignedToUserId,
        recurrence: value.recurrence,
        dueDate: value.dueDate,
        recurrenceDays: value.recurrenceDays,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chores"] });
      setEditing(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteChore(chore.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["chores"] }),
  });

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateMutation.mutate();
        }}
        className="space-y-2 rounded-lg border border-border p-4"
      >
        <ChoreFields members={members} value={value} onChange={setValue} />

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setValue(defaultChoreFieldsValue(chore));
              setEditing(false);
            }}
            className="rounded-md border border-border px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-4">
      <div>
        <p className="font-medium">{chore.title}</p>
        <p className="text-xs text-muted-foreground">
          {assignee ? `${assignee.avatarEmoji} ${assignee.name}` : "Unassigned"} · {chore.points} pts ·{" "}
          {describeRecurrence({
            recurrence: chore.recurrence,
            dueDate: parseDueDate(chore.dueDate),
            recurrenceDays: chore.recurrenceDays,
          })}
        </p>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground">
          Edit
        </button>
        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="text-danger hover:text-danger-hover"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
