import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { test } from "vitest";
import { db } from "@/db";
import { households, rewardRedemptions, rewards, users } from "@/db/schema";
import { createProfileSession, createSession } from "@/lib/auth/session";
import {
  createReward,
  deleteReward,
  redeemReward,
  toggleRewardActive,
  updateReward,
} from "./rewards.ts";

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

async function seed(points = 0, role: "admin" | "member" = "admin") {
  const householdId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  await db.insert(households).values({ id: householdId, name: "The Hatfields" });
  await db.insert(users).values({ id: userId, householdId, name: "Jeremy", role, points });
  await createSession(householdId);
  await createProfileSession(householdId, userId);
  return { householdId, userId };
}

test("createReward: rejects a missing title", async () => {
  await seed();
  const result = await createReward(null, formData({ title: "  ", pointCost: "10" }));
  assert.deepEqual(result, { error: "Title is required." });
});

test("createReward: rejects a non-positive point cost", async () => {
  await seed();
  const result = await createReward(null, formData({ title: "Ice cream", pointCost: "0" }));
  assert.deepEqual(result, { error: "Point cost must be a positive number." });
});

test("createReward: creates a reward", async () => {
  const { householdId } = await seed();
  const result = await createReward(
    null,
    formData({ title: "Ice cream", description: "One scoop", pointCost: "10" }),
  );
  assert.equal(result, null);

  const reward = await db.query.rewards.findFirst({
    where: eq(rewards.householdId, householdId),
  });
  assert.equal(reward?.title, "Ice cream");
  assert.equal(reward?.pointCost, 10);
});

test("updateReward: rejects an unknown reward", async () => {
  await seed();
  const result = await updateReward(
    null,
    formData({ id: "missing", title: "x", pointCost: "5" }),
  );
  assert.deepEqual(result, { error: "Reward not found." });
});

test("updateReward: validates fields before saving", async () => {
  const { householdId } = await seed();
  const id = crypto.randomUUID();
  await db.insert(rewards).values({ id, householdId, title: "Old", pointCost: 5 });

  const result = await updateReward(null, formData({ id, title: "", pointCost: "5" }));
  assert.deepEqual(result, { error: "Title is required." });
});

test("updateReward: updates the reward", async () => {
  const { householdId } = await seed();
  const id = crypto.randomUUID();
  await db.insert(rewards).values({ id, householdId, title: "Old", pointCost: 5 });

  await updateReward(null, formData({ id, title: "New", pointCost: "15" }));
  const reward = await db.query.rewards.findFirst({ where: eq(rewards.id, id) });
  assert.equal(reward?.title, "New");
  assert.equal(reward?.pointCost, 15);
});

test("toggleRewardActive: no-ops for an unknown reward", async () => {
  await seed();
  await toggleRewardActive(formData({ id: "missing" }));
});

test("toggleRewardActive: flips isActive", async () => {
  const { householdId } = await seed();
  const id = crypto.randomUUID();
  await db.insert(rewards).values({ id, householdId, title: "Reward", pointCost: 5 });

  await toggleRewardActive(formData({ id }));
  const reward = await db.query.rewards.findFirst({ where: eq(rewards.id, id) });
  assert.equal(reward?.isActive, false);
});

test("deleteReward: deletes a reward", async () => {
  const { householdId } = await seed();
  const id = crypto.randomUUID();
  await db.insert(rewards).values({ id, householdId, title: "Reward", pointCost: 5 });

  await deleteReward(formData({ id }));
  const reward = await db.query.rewards.findFirst({ where: eq(rewards.id, id) });
  assert.equal(reward, undefined);
});

test("redeemReward: rejects an unknown or inactive reward", async () => {
  const { householdId } = await seed(100);
  const inactiveId = crypto.randomUUID();
  await db.insert(rewards).values({
    id: inactiveId,
    householdId,
    title: "Inactive",
    pointCost: 5,
    isActive: false,
  });

  assert.deepEqual(
    await redeemReward(null, formData({ rewardId: "missing" })),
    { error: "Reward not available." },
  );
  assert.deepEqual(
    await redeemReward(null, formData({ rewardId: inactiveId })),
    { error: "Reward not available." },
  );
});

test("redeemReward: rejects when the user doesn't have enough points", async () => {
  const { householdId } = await seed(5);
  const id = crypto.randomUUID();
  await db.insert(rewards).values({ id, householdId, title: "Reward", pointCost: 10 });

  const result = await redeemReward(null, formData({ rewardId: id }));
  assert.deepEqual(result, { error: "Not enough points yet." });
});

test("redeemReward: spends points and records a redemption", async () => {
  const { householdId, userId } = await seed(20);
  const id = crypto.randomUUID();
  await db.insert(rewards).values({ id, householdId, title: "Reward", pointCost: 10 });

  const result = await redeemReward(null, formData({ rewardId: id }));
  assert.equal(result, null);

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  assert.equal(user?.points, 10);

  const redemption = await db.query.rewardRedemptions.findFirst({
    where: eq(rewardRedemptions.rewardId, id),
  });
  assert.equal(redemption?.pointsSpent, 10);
  assert.equal(redemption?.userId, userId);
});
