"use client";

import { useActionState, useState } from "react";
import type { chores, users } from "@/db/schema";
import { deleteChore, updateChore } from "@/lib/actions/chores";
import { describeRecurrence } from "@/lib/chores/recurrence";
import { ChoreFields } from "./chore-fields";

type Chore = typeof chores.$inferSelect;
type Member = typeof users.$inferSelect;

export function ChoreRow({
  chore,
  members,
}: {
  chore: Chore;
  members: Member[];
}) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateChore, null);
  const assignee = members.find((m) => m.id === chore.assignedToUserId);

  if (editing) {
    return (
      <form
        action={formAction}
        className="space-y-2 rounded-lg border border-border p-4"
      >
        <input type="hidden" name="id" value={chore.id} />
        <ChoreFields members={members} defaults={chore} />

        {state?.error && (
          <p className="text-sm text-danger" role="alert">
            {state.error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
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
          {assignee ? `${assignee.avatarEmoji} ${assignee.name}` : "Unassigned"}{" "}
          · {chore.points} pts · {describeRecurrence(chore)}
        </p>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <button
          onClick={() => setEditing(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          Edit
        </button>
        <form action={deleteChore}>
          <input type="hidden" name="id" value={chore.id} />
          <button className="text-danger hover:text-danger-hover">Delete</button>
        </form>
      </div>
    </div>
  );
}
