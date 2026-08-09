"use client";

import { useActionState } from "react";
import { createReward } from "@/lib/actions/rewards";

export function RewardForm() {
  const [state, formAction, pending] = useActionState(createReward, null);

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
        name="description"
        placeholder="Description (optional)"
        rows={2}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <input
        name="pointCost"
        type="number"
        min={1}
        required
        placeholder="Point cost"
        className="w-32 rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />

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
        {pending ? "Adding..." : "Add reward"}
      </button>
    </form>
  );
}
