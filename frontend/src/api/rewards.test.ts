import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "@/test/mockApi";
import * as rewards from "./rewards";

afterEach(() => {
  vi.unstubAllGlobals();
});

const rewardInput: rewards.RewardInput = { title: "Movie night", pointCost: 20 };

describe("rewards api", () => {
  it("listRewards gets /rewards", async () => {
    mockApi({ "GET /api/rewards": { body: { rewards: [] } } });
    await expect(rewards.listRewards()).resolves.toEqual({ rewards: [] });
  });

  it("createReward posts input", async () => {
    mockApi({ "POST /api/rewards": { body: { id: "rw1", ...rewardInput } } });
    await expect(rewards.createReward(rewardInput)).resolves.toMatchObject({ id: "rw1" });
  });

  it("updateReward patches by id", async () => {
    mockApi({ "PATCH /api/rewards/rw1": { body: { id: "rw1", ...rewardInput } } });
    await expect(rewards.updateReward("rw1", rewardInput)).resolves.toMatchObject({ id: "rw1" });
  });

  it("toggleRewardActive patches /rewards/:id/toggle", async () => {
    mockApi({ "PATCH /api/rewards/rw1/toggle": { body: { id: "rw1", active: false } } });
    await expect(rewards.toggleRewardActive("rw1")).resolves.toMatchObject({ active: false });
  });

  it("deleteReward deletes by id", async () => {
    mockApi({ "DELETE /api/rewards/rw1": { body: { ok: true } } });
    await expect(rewards.deleteReward("rw1")).resolves.toEqual({ ok: true });
  });

  it("redeemReward posts /rewards/:id/redeem", async () => {
    mockApi({ "POST /api/rewards/rw1/redeem": { body: { id: "red1" } } });
    await expect(rewards.redeemReward("rw1")).resolves.toEqual({ id: "red1" });
  });
});
