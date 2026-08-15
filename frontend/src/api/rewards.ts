import { api } from "./client";
import type { Reward, RewardRedemption } from "@/types";

export function listRewards() {
  return api.get<{ rewards: Reward[] }>("/rewards");
}

export type RewardInput = {
  title: string;
  description?: string | null;
  pointCost: number;
};

export function createReward(input: RewardInput) {
  return api.post<Reward>("/rewards", input);
}

export function updateReward(id: string, input: RewardInput) {
  return api.patch<Reward>(`/rewards/${id}`, input);
}

export function toggleRewardActive(id: string) {
  return api.patch<Reward>(`/rewards/${id}/toggle`);
}

export function deleteReward(id: string) {
  return api.delete<{ ok: boolean }>(`/rewards/${id}`);
}

export function redeemReward(id: string) {
  return api.post<RewardRedemption>(`/rewards/${id}/redeem`);
}
