import { useQuery } from "@tanstack/react-query";
import { listChores } from "@/api/chores";
import { listMembers } from "@/api/members";
import { useAuth } from "@/context/AuthContext";
import { TodayChore } from "@/components/TodayChore";
import { ChoreRow } from "@/components/ChoreRow";
import { ChoreForm } from "@/components/ChoreForm";

export default function ChoresPage() {
  const { profile } = useAuth();

  const membersQuery = useQuery({ queryKey: ["members"], queryFn: listMembers });
  const todayQuery = useQuery({ queryKey: ["chores", "today"], queryFn: () => listChores(true) });
  const allChoresQuery = useQuery({ queryKey: ["chores", "all"], queryFn: () => listChores(false) });

  if (!profile) return null;

  const members = membersQuery.data?.members ?? [];
  const membersById = new Map(members.map((m) => [m.id, m]));
  const dueToday = [...(todayQuery.data?.chores ?? [])].sort((a, b) => a.title.localeCompare(b.title));
  const allChores = [...(allChoresQuery.data?.chores ?? [])].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h1 className="text-xl font-semibold">Today</h1>
        {dueToday.length === 0 ? (
          <p className="text-sm text-muted-foreground">No chores due today.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {dueToday.map((chore) => {
              const assignee = chore.assignedToUserId ? membersById.get(chore.assignedToUserId) ?? null : null;
              return (
                <TodayChore
                  key={chore.id}
                  chore={{ id: chore.id, title: chore.title, points: chore.points, completedToday: chore.completedToday }}
                  assignee={assignee}
                  canAct={profile.role === "hoh" || chore.assignedToUserId === profile.id}
                />
              );
            })}
          </div>
        )}
      </section>

      {profile.role === "hoh" && (
        <section className="space-y-4 border-t border-border pt-8">
          <h2 className="text-lg font-semibold">All chores</h2>
          <div className="space-y-2">
            {allChores.map((chore) => (
              <ChoreRow key={chore.id} chore={chore} members={members} />
            ))}
          </div>

          <div className="max-w-md space-y-3 pt-4">
            <h3 className="font-medium">Add a chore</h3>
            <ChoreForm members={members} />
          </div>
        </section>
      )}
    </div>
  );
}
