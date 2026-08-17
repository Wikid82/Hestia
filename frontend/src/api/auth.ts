import { api } from "./client";
import type { Household, Profile } from "@/types";

export type SignupInput = {
  householdName: string;
  name: string;
  email: string;
  password: string;
};

export type SignupResponse = { household: Household; user: Profile };

export function signup(input: SignupInput) {
  return api.post<SignupResponse>("/auth/signup", input);
}

export type LoginInput = { email: string; password: string };
export type LoginResponse = { user: Profile };

export function login(input: LoginInput) {
  return api.post<LoginResponse>("/auth/login", input);
}

export function logout() {
  return api.post<{ ok: boolean }>("/auth/logout");
}

export type MeResponse = { household: Household; user: Profile | null };

export function me() {
  return api.get<MeResponse>("/auth/me");
}
