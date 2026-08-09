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
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {pending ? "Adding..." : "Add chore"}
      </button>
    </form>
  );
}
