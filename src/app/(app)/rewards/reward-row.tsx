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
        className="space-y-2 rounded-lg border border-border p-4"
      >
        <input type="hidden" name="id" value={reward.id} />
        <input
          name="title"
          type="text"
          required
          defaultValue={reward.title}
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
        <textarea
          name="description"
          defaultValue={reward.description ?? ""}
          rows={2}
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
        <input
          name="pointCost"
          type="number"
          min={1}
          required
          defaultValue={reward.pointCost}
          className="w-32 rounded-md border border-border px-2 py-2 text-sm"
        />

        {state?.error && (
          <p className="text-sm text-danger" role="alert">
            {state.error}
          </p>
        )}

        <div className="flex gap-2">
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
        <p className={`font-medium ${reward.isActive ? "" : "text-muted-foreground"}`}>
          {reward.title} {!reward.isActive && "(archived)"}
        </p>
        <p className="text-xs text-muted-foreground">{reward.pointCost} pts</p>
      </div>
      <div className="flex items-center gap-3 text-sm">
        <button
          onClick={() => setEditing(true)}
          className="text-muted-foreground hover:text-foreground"
        >
          Edit
        </button>
        <form action={toggleRewardActive}>
          <input type="hidden" name="id" value={reward.id} />
          <button className="text-muted-foreground hover:text-foreground">
            {reward.isActive ? "Archive" : "Unarchive"}
          </button>
        </form>
        <form action={deleteReward}>
          <input type="hidden" name="id" value={reward.id} />
          <button className="text-danger hover:text-danger-hover">Delete</button>
        </form>
      </div>
    </div>
  );
}
