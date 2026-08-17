import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { redeemReward } from "@/api/rewards";
import { ApiError } from "@/api/client";

export function RewardCard({
  reward,
  userPoints,
}: {
  reward: { id: string; title: string; description?: string | null; pointCost: number };
  userPoints: number;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const affordable = userPoints >= reward.pointCost;

  const mutation = useMutation({
    mutationFn: () => redeemReward(reward.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <div>
        <p className="font-medium">{reward.title}</p>
        {reward.description && <p className="text-sm text-muted-foreground">{reward.description}</p>}
        <p className="text-xs text-muted-foreground">{reward.pointCost} pts</p>
      </div>

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !affordable}
        className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
      >
        {affordable ? "Redeem" : "Not enough points"}
      </button>
    </div>
  );
}
