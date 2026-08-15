import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createReminder } from "@/api/reminders";
import { ApiError } from "@/api/client";
import type { Profile } from "@/types";

export function ReminderForm({ members, isAdmin }: { members: Profile[]; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [assignedToUserId, setAssignedToUserId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createReminder({
        title,
        notes: notes || null,
        dueAt: dueAt || undefined,
        assignedToUserId: assignedToUserId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders"] });
      setTitle("");
      setNotes("");
      setDueAt("");
      setAssignedToUserId("");
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-2"
    >
      <input
        name="title"
        type="text"
        required
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      <textarea
        name="notes"
        placeholder="Notes (optional)"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <input
          name="dueAt"
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className="flex-1 rounded-md border border-border px-2 py-2 text-sm"
        />
        {isAdmin ? (
          <select
            name="assignedToUserId"
            value={assignedToUserId}
            onChange={(e) => setAssignedToUserId(e.target.value)}
            className="flex-1 rounded-md border border-border px-2 py-2 text-sm"
          >
            <option value="">Everyone</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.avatarEmoji} {member.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {mutation.isPending ? "Adding..." : "Add reminder"}
      </button>
    </form>
  );
}
