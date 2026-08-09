"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { rewardRedemptions, rewards, users } from "@/db/schema";
import { requireActiveUser, requireAdmin } from "@/lib/auth/current-user";
import type { FormState } from "./form-state";

type RewardFieldsResult =
  | { error: string }
  | { title: string; description: string | null; pointCost: number };

function readRewardFields(formData: FormData): RewardFieldsResult {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const pointCost = Number.parseInt(String(formData.get("pointCost") ?? "0"), 10);

  if (!title) return { error: "Title is required." };
  if (!Number.isFinite(pointCost) || pointCost <= 0) {
    return { error: "Point cost must be a positive number." };
  }

  return { title, description: description || null, pointCost };
}

export async function createReward(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { household, user } = await requireActiveUser();
  requireAdmin(user);

  const fields = readRewardFields(formData);
  if ("error" in fields) return { error: fields.error };

  await db.insert(rewards).values({
    id: crypto.randomUUID(),
    householdId: household.id,
    title: fields.title,
    description: fields.description,
    pointCost: fields.pointCost,
  });

  revalidatePath("/rewards");
  return null;
}

export async function updateReward(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { household, user } = await requireActiveUser();
  requireAdmin(user);

  const id = String(formData.get("id") ?? "");
  const existing = await db.query.rewards.findFirst({
    where: and(eq(rewards.id, id), eq(rewards.householdId, household.id)),
  });
  if (!existing) return { error: "Reward not found." };

  const fields = readRewardFields(formData);
  if ("error" in fields) return { error: fields.error };

  await db
    .update(rewards)
    .set({
      title: fields.title,
      description: fields.description,
      pointCost: fields.pointCost,
    })
    .where(eq(rewards.id, id));

  revalidatePath("/rewards");
  return null;
}

export async function toggleRewardActive(formData: FormData) {
  const { household, user } = await requireActiveUser();
  requireAdmin(user);

  const id = String(formData.get("id") ?? "");
  const existing = await db.query.rewards.findFirst({
    where: and(eq(rewards.id, id), eq(rewards.householdId, household.id)),
  });
  if (!existing) return;

  await db
    .update(rewards)
    .set({ isActive: !existing.isActive })
    .where(eq(rewards.id, id));

  revalidatePath("/rewards");
}

export async function deleteReward(formData: FormData) {
  const { household, user } = await requireActiveUser();
  requireAdmin(user);

  const id = String(formData.get("id") ?? "");
  await db
    .delete(rewards)
    .where(and(eq(rewards.id, id), eq(rewards.householdId, household.id)));

  revalidatePath("/rewards");
}

export async function redeemReward(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const { household, user } = await requireActiveUser();

  const rewardId = String(formData.get("rewardId") ?? "");
  const reward = await db.query.rewards.findFirst({
    where: and(
      eq(rewards.id, rewardId),
      eq(rewards.householdId, household.id),
    ),
  });
  if (!reward || !reward.isActive) return { error: "Reward not available." };

  if (user.points < reward.pointCost) {
    return { error: "Not enough points yet." };
  }

  db.transaction((tx) => {
    tx.insert(rewardRedemptions)
      .values({
        id: crypto.randomUUID(),
        rewardId: reward.id,
        userId: user.id,
        pointsSpent: reward.pointCost,
      })
      .run();

    tx.update(users)
      .set({ points: sql`${users.points} - ${reward.pointCost}` })
      .where(eq(users.id, user.id))
      .run();
  });

  revalidatePath("/rewards");
  revalidatePath("/");
  return null;
}
