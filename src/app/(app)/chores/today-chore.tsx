import { completeChore, uncompleteChore } from "@/lib/actions/chores";

type Assignee = { name: string; avatarEmoji: string } | null;

export function TodayChore({
  chore,
  assignee,
  done,
  canAct,
}: {
  chore: { id: string; title: string; points: number };
  assignee: Assignee;
  done: boolean;
  canAct: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-lg border p-3 ${
        done
          ? "border-border bg-surface"
          : "border-border"
      }`}
    >
      <div>
        <p className={done ? "line-through text-muted-foreground" : ""}>
          {chore.title}
        </p>
        <p className="text-xs text-muted-foreground">
          {assignee ? `${assignee.avatarEmoji} ${assignee.name}` : "Unassigned"}{" "}
          · {chore.points} pts
        </p>
      </div>

      {canAct &&
        (done ? (
          <form action={uncompleteChore}>
            <input type="hidden" name="choreId" value={chore.id} />
            <button className="text-sm text-muted-foreground hover:text-foreground">
              Undo
            </button>
          </form>
        ) : (
          <form action={completeChore}>
            <input type="hidden" name="choreId" value={chore.id} />
            <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
              Done
            </button>
          </form>
        ))}
    </div>
  );
}
