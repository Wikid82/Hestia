"use client";

import { useActionState } from "react";
import { redeemReward } from "@/lib/actions/rewards";

export function RewardCard({
  reward,
  userPoints,
}: {
  reward: { id: string; title: string; description: string | null; pointCost: number };
  userPoints: number;
}) {
  const [state, formAction, pending] = useActionState(redeemReward, null);
  const affordable = userPoints >= reward.pointCost;

  return (
    <div className="space-y-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div>
        <p className="font-medium">{reward.title}</p>
        {reward.description && (
          <p className="text-sm text-neutral-500">{reward.description}</p>
        )}
        <p className="text-xs text-neutral-500">{reward.pointCost} pts</p>
      </div>

      {state?.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <form action={formAction}>
        <input type="hidden" name="rewardId" value={reward.id} />
        <button
          type="submit"
          disabled={pending || !affordable}
          className="w-full rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          {affordable ? "Redeem" : "Not enough points"}
        </button>
      </form>
    </div>
  );
}
