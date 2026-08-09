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
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <textarea
        name="notes"
        placeholder="Notes (optional)"
        rows={2}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <div className="flex gap-2">
        <input
          name="dueAt"
          type="date"
          className="flex-1 rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        {isAdmin ? (
          <select
            name="assignedToUserId"
            defaultValue=""
            className="flex-1 rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
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
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Adding..." : "Add reminder"}
      </button>
    </form>
  );
}
