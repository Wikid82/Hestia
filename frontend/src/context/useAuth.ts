import { createContext, useContext } from "react";
import * as authApi from "@/api/auth";
import * as invitesApi from "@/api/invites";
import type { Household, Profile } from "@/types";

export type Status = "loading" | "unauthenticated" | "need-profile" | "authed";

export type AuthState = {
  status: Status;
  household: Household | null;
  profile: Profile | null;
};

export type AuthContextValue = AuthState & {
  refresh: () => Promise<void>;
  login: (input: authApi.LoginInput) => Promise<void>;
  signup: (input: authApi.SignupInput) => Promise<void>;
  acceptInvite: (token: string, input: invitesApi.AcceptInviteInput) => Promise<void>;
  logout: () => Promise<void>;
  switchProfile: (userId: string, pin?: string) => Promise<void>;
  switchToPicker: () => Promise<void>;
  setHousehold: (household: Household) => void;
  setProfile: (profile: Profile) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
