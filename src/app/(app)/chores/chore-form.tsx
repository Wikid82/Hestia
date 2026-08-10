"use client";

import { useActionState } from "react";
import type { users } from "@/db/schema";
import { createChore } from "@/lib/actions/chores";
import { ChoreFields } from "./chore-fields";

type Member = typeof users.$inferSelect;

export function ChoreForm({ members }: { members: Member[] }) {
  const [state, formAction, pending] = useActionState(createChore, null);

  return (
    <form action={formAction} className="space-y-2">
      <ChoreFields members={members} />

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
        {pending ? "Adding..." : "Add chore"}
      </button>
    </form>
  );
}
