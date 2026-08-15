import { api } from "./client";
import type { Household, ThemePreference } from "@/types";

export function getHousehold() {
  return api.get<Household>("/household");
}

export function updateHousehold(input: { name?: string; themePreference?: ThemePreference }) {
  return api.patch<Household>("/household", input);
}
