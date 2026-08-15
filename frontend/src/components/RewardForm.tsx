import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createReward } from "@/api/rewards";
import { ApiError } from "@/api/client";

export function RewardForm() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pointCost, setPointCost] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createReward({ title, description: description || null, pointCost }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
      setTitle("");
      setDescription("");
      setPointCost(1);
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Something went wrong"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-2"
    >
      <input
        name="title"
        type="text"
        required
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      <textarea
        name="description"
        placeholder="Description (optional)"
        rows={2}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      <input
        name="pointCost"
        type="number"
        min={1}
        required
        placeholder="Point cost"
        value={pointCost}
        onChange={(e) => setPointCost(Number(e.target.value))}
        className="w-32 rounded-md border border-border px-2 py-2 text-sm"
      />

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {mutation.isPending ? "Adding..." : "Add reward"}
      </button>
    </form>
  );
}
