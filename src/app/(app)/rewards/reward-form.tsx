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
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      <textarea
        name="description"
        placeholder="Description (optional)"
        rows={2}
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      <input
        name="pointCost"
        type="number"
        min={1}
        required
        placeholder="Point cost"
        className="w-32 rounded-md border border-border px-2 py-2 text-sm"
      />

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
        {pending ? "Adding..." : "Add reward"}
      </button>
    </form>
  );
}
