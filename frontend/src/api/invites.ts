import { api } from "./client";
import type { Household, Invite, InviteStatus, Profile, Role } from "@/types";

type CreateInviteResponse = { invite: Invite; emailSent: boolean; emailError?: string };

// Admin-issued (system-admin only): invites a new Head of Household, who
// gets their own independent household on accept.
export function createHoHInvite(email: string) {
  return api.post<CreateInviteResponse>("/admin/invites", { email });
}
export function listHoHInvites() {
  return api.get<{ invites: Invite[] }>("/admin/invites");
}
export function revokeHoHInvite(id: string) {
  return api.delete<{ ok: true }>(`/admin/invites/${id}`);
}

// HoH-issued: invites someone to join the acting HoH's own household.
export function createMemberInvite(email: string) {
  return api.post<CreateInviteResponse>("/members/invites", { email });
}
export function listMemberInvites() {
  return api.get<{ invites: Invite[] }>("/members/invites");
}
export function revokeMemberInvite(id: string) {
  return api.delete<{ ok: true }>(`/members/invites/${id}`);
}

// Public: preview + accept, no auth required.
export type InvitePreview = {
  role: Role;
  email: string;
  status: InviteStatus;
  householdName?: string;
  expiresAt: string;
};

export function getInvitePreview(token: string) {
  return api.get<InvitePreview>(`/invites/${token}`);
}

export type AcceptInviteInput = { name: string; password: string; householdName?: string };

export function acceptInvite(token: string, input: AcceptInviteInput) {
  return api.post<{ household: Household; user: Profile }>(`/invites/${token}/accept`, input);
}
