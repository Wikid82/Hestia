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
    <div className="space-y-2 rounded-lg border border-border p-4">
      <div>
        <p className="font-medium">{reward.title}</p>
        {reward.description && (
          <p className="text-sm text-muted-foreground">{reward.description}</p>
        )}
        <p className="text-xs text-muted-foreground">{reward.pointCost} pts</p>
      </div>

      {state?.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}

      <form action={formAction}>
        <input type="hidden" name="rewardId" value={reward.id} />
        <button
          type="submit"
          disabled={pending || !affordable}
          className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          {affordable ? "Redeem" : "Not enough points"}
        </button>
      </form>
    </div>
  );
}
