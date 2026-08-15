import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createChore } from "@/api/chores";
import { ApiError } from "@/api/client";
import type { Profile } from "@/types";
import { ChoreFields, defaultChoreFieldsValue, type ChoreFieldsValue } from "./ChoreFields";

export function ChoreForm({ members }: { members: Profile[] }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState<ChoreFieldsValue>(defaultChoreFieldsValue());
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createChore({
        title: value.title,
        description: value.description || null,
        points: value.points,
        assignedToUserId: value.assignedToUserId,
        recurrence: value.recurrence,
        dueDate: value.dueDate,
        recurrenceDays: value.recurrenceDays,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chores"] });
      setValue(defaultChoreFieldsValue());
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
      <ChoreFields members={members} value={value} onChange={setValue} />

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
        {mutation.isPending ? "Adding..." : "Add chore"}
      </button>
    </form>
  );
}
