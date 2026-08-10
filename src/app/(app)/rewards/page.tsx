import { eq } from "drizzle-orm";
import { db } from "@/db";
import { rewards } from "@/db/schema";
import { requireActiveUser } from "@/lib/auth/current-user";
import { RewardCard } from "./reward-card";
import { RewardForm } from "./reward-form";
import { RewardRow } from "./reward-row";

export default async function RewardsPage() {
  const { household, user } = await requireActiveUser();

  const allRewards = await db.query.rewards.findMany({
    where: eq(rewards.householdId, household.id),
    orderBy: (rewards, { asc }) => [asc(rewards.pointCost)],
  });
  const activeRewards = allRewards.filter((reward) => reward.isActive);

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-semibold">Rewards</h1>
          <span className="text-sm text-muted-foreground">
            You have {user.points} pts
          </span>
        </div>
        {activeRewards.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No rewards in the store yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {activeRewards.map((reward) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                userPoints={user.points}
              />
            ))}
          </div>
        )}
      </section>

      {user.role === "admin" && (
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
