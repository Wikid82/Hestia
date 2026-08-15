import { useQuery } from "@tanstack/react-query";
import { listRewards } from "@/api/rewards";
import { useAuth } from "@/context/AuthContext";
import { RewardCard } from "@/components/RewardCard";
import { RewardRow } from "@/components/RewardRow";
import { RewardForm } from "@/components/RewardForm";

export default function RewardsPage() {
  const { profile } = useAuth();
  const rewardsQuery = useQuery({ queryKey: ["rewards"], queryFn: listRewards });

  if (!profile) return null;

  const allRewards = [...(rewardsQuery.data?.rewards ?? [])].sort((a, b) => a.pointCost - b.pointCost);
  const activeRewards = allRewards.filter((r) => r.isActive);

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-semibold">Rewards</h1>
          <span className="text-sm text-muted-foreground">You have {profile.points} pts</span>
        </div>
        {activeRewards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rewards in the store yet.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {activeRewards.map((reward) => (
              <RewardCard key={reward.id} reward={reward} userPoints={profile.points} />
            ))}
          </div>
        )}
      </section>

      {profile.role === "admin" && (
        <section className="space-y-4 border-t border-border pt-8">
          <h2 className="text-lg font-semibold">Manage rewards</h2>
          <div className="space-y-2">
            {allRewards.map((reward) => (
              <RewardRow key={reward.id} reward={reward} />
            ))}
          </div>

          <div className="max-w-md space-y-3 pt-4">
            <h3 className="font-medium">Add a reward</h3>
            <RewardForm />
          </div>
        </section>
      )}
    </div>
  );
}
