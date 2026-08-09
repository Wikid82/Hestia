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
          ? "border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
          : "border-neutral-200 dark:border-neutral-800"
      }`}
    >
      <div>
        <p className={done ? "line-through text-neutral-400" : ""}>
          {chore.title}
        </p>
        <p className="text-xs text-neutral-500">
          {assignee ? `${assignee.avatarEmoji} ${assignee.name}` : "Unassigned"}{" "}
          · {chore.points} pts
        </p>
      </div>

      {canAct &&
        (done ? (
          <form action={uncompleteChore}>
            <input type="hidden" name="choreId" value={chore.id} />
            <button className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100">
              Undo
            </button>
          </form>
        ) : (
          <form action={completeChore}>
            <input type="hidden" name="choreId" value={chore.id} />
            <button className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
              Done
            </button>
          </form>
        ))}
    </div>
  );
}
