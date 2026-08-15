import { api } from "./client";
import type { Profile } from "@/types";

export function listProfiles() {
  return api.get<{ profiles: Profile[] }>("/profiles");
}

export function switchProfile(userId: string, pin?: string) {
  return api.post<{ user: Profile }>(`/profiles/${userId}/switch`, { pin: pin ?? "" });
}

export function switchToPicker() {
  return api.post<{ ok: boolean }>("/profiles/to-picker");
}
