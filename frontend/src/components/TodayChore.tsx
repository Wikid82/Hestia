import { useMutation, useQueryClient } from "@tanstack/react-query";
import { completeChore, uncompleteChore } from "@/api/chores";

type Assignee = { name: string; avatarEmoji: string } | null;

export function TodayChore({
  chore,
  assignee,
  canAct,
}: {
  chore: { id: string; title: string; points: number; completedToday: boolean };
  assignee: Assignee;
  canAct: boolean;
}) {
  const queryClient = useQueryClient();
  const done = chore.completedToday;

  // completedToday comes from the server (GET /chores), so a successful
  // mutation just needs to invalidate the chores queries — no local
  // "done today" state to track, and it survives a page reload.
  const completeMutation = useMutation({
    mutationFn: () => completeChore(chore.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chores"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });

  const uncompleteMutation = useMutation({
    mutationFn: () => uncompleteChore(chore.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chores"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });

  const pending = completeMutation.isPending || uncompleteMutation.isPending;

  return (
    <div className="flex items-center justify-between rounded-lg border border-border p-3">
      <div>
        <p className={done ? "line-through text-muted-foreground" : ""}>{chore.title}</p>
        <p className="text-xs text-muted-foreground">
          {assignee ? `${assignee.avatarEmoji} ${assignee.name}` : "Unassigned"} · {chore.points} pts
        </p>
      </div>

      {canAct &&
        (done ? (
          <button
            onClick={() => uncompleteMutation.mutate()}
            disabled={pending}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Undo
          </button>
        ) : (
          <button
            onClick={() => completeMutation.mutate()}
            disabled={pending}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Done
          </button>
        ))}
    </div>
  );
}
