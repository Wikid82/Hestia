"use client";

import { useActionState } from "react";
import type { users } from "@/db/schema";
import { createReminder } from "@/lib/actions/reminders";

type Member = typeof users.$inferSelect;

export function ReminderForm({
  members,
  isAdmin,
}: {
  members: Member[];
  isAdmin: boolean;
}) {
  const [state, formAction, pending] = useActionState(createReminder, null);

  return (
    <form action={formAction} className="space-y-2">
      <input
        name="title"
        type="text"
        required
        placeholder="Title"
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      <textarea
        name="notes"
        placeholder="Notes (optional)"
        rows={2}
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <input
          name="dueAt"
          type="date"
          className="flex-1 rounded-md border border-border px-2 py-2 text-sm"
        />
        {isAdmin ? (
          <select
            name="assignedToUserId"
            defaultValue=""
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

      {state?.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add reminder"}
      </button>
    </form>
  );
}
