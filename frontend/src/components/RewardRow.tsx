import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteReward, toggleRewardActive, updateReward } from "@/api/rewards";
import { ApiError } from "@/api/client";
import type { Reward } from "@/types";

export function RewardRow({ reward }: { reward: Reward }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(reward.title);
  const [description, setDescription] = useState(reward.description ?? "");
  const [pointCost, setPointCost] = useState(reward.pointCost);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["rewards"] });

  const updateMutation = useMutation({
    mutationFn: () => updateReward(reward.id, { title, description: description || null, pointCost }),
    onSuccess: () => {
      invalidate();
      setEditing(false);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  const toggleMutation = useMutation({ mutationFn: () => toggleRewardActive(reward.id), onSuccess: invalidate });
  const deleteMutation = useMutation({ mutationFn: () => deleteReward(reward.id), onSuccess: invalidate });

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateMutation.mutate();
        }}
        className="space-y-2 rounded-lg border border-border p-4"
      >
        <input
          name="title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
        <textarea
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-border px-3 py-2 text-sm"
        />
        <input
          name="pointCost"
          type="number"
          min={1}
          required
          value={pointCost}
          onChange={(e) => setPointCost(Number(e.target.value))}
          className="w-32 rounded-md border border-border px-2 py-2 text-sm"
        />

        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={updateMutation.isPending}
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
        <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground">
          Edit
        </button>
        <button
          onClick={() => toggleMutation.mutate()}
          disabled={toggleMutation.isPending}
          className="text-muted-foreground hover:text-foreground"
        >
          {reward.isActive ? "Archive" : "Unarchive"}
        </button>
        <button
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          className="text-danger hover:text-danger-hover"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
