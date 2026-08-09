"use client";

import { useActionState, useState } from "react";
import type { rewards } from "@/db/schema";
import { deleteReward, toggleRewardActive, updateReward } from "@/lib/actions/rewards";

type Reward = typeof rewards.$inferSelect;

export function RewardRow({ reward }: { reward: Reward }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, pending] = useActionState(updateReward, null);

  if (editing) {
    return (
      <form
        action={formAction}
        className="space-y-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
      >
        <input type="hidden" name="id" value={reward.id} />
        <input
          name="title"
          type="text"
          required
          defaultValue={reward.title}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <textarea
          name="description"
          defaultValue={reward.description ?? ""}
          rows={2}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <input
          name="pointCost"
          type="number"
          min={1}
          required
          defaultValue={reward.pointCost}
          className="w-32 rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />

        {state?.error && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div>
        <p className={`font-medium ${reward.isActive ? "" : "text-neutral-400"}`}>
          {reward.title} {!reward.isActive && "(archived)"}
        </p>
        <p className="text-xs text-neutral-500">{reward.pointCost} pts</p>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <button
          onClick={() => setEditing(true)}
          className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          Edit
        </button>
        <form action={toggleRewardActive}>
          <input type="hidden" name="id" value={reward.id} />
          <button className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
            {reward.isActive ? "Archive" : "Unarchive"}
          </button>
        </form>
        <form action={deleteReward}>
          <input type="hidden" name="id" value={reward.id} />
          <button className="text-red-600 hover:text-red-800">Delete</button>
        </form>
      </div>
    </div>
  );
}
