import { api } from "./client";
import type { Profile, Role } from "@/types";

export function listMembers() {
  return api.get<{ members: Profile[] }>("/members");
}

export function getMember(id: string) {
  return api.get<Profile>(`/members/${id}`);
}

export type MemberInput = {
  name: string;
  role: Role;
  avatarEmoji: string;
  pin?: string;
};

export function createMember(input: MemberInput) {
  return api.post<Profile>("/members", input);
}

export function updateMember(id: string, input: MemberInput) {
  return api.patch<Profile>(`/members/${id}`, input);
}

export type SetCredentialsInput = {
  email: string;
  password: string;
  currentPassword?: string;
};

// Self-service: sets/changes the active profile's own login. currentPassword
// is required by the backend only if the profile already has a password.
export function setOwnCredentials(input: SetCredentialsInput) {
  return api.patch<Profile>("/members/me/credentials", input);
}

// HoH-only admin override: sets/resets another member's login directly,
// no current password required.
export function setMemberCredentials(id: string, input: Omit<SetCredentialsInput, "currentPassword">) {
  return api.patch<Profile>(`/members/${id}/credentials`, input);
}

export function clearMemberPin(id: string) {
  return api.delete<{ ok: boolean }>(`/members/${id}/pin`);
}

export function deleteMember(id: string) {
  return api.delete<{ ok: boolean }>(`/members/${id}`);
}
