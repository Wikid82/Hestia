import { api } from "./client";
import type { Chore, ChoreCompletion, Recurrence } from "@/types";

export function listChores(dueToday?: boolean) {
  return api.get<{ chores: Chore[] }>(`/chores${dueToday ? "?due=today" : ""}`);
}

export function getChore(id: string) {
  return api.get<Chore>(`/chores/${id}`);
}

export type ChoreInput = {
  title: string;
  description?: string | null;
  points: number;
  assignedToUserId: string;
  recurrence: Recurrence;
  dueDate: string; // YYYY-MM-DD
  recurrenceDays?: number[];
};

export function createChore(input: ChoreInput) {
  return api.post<Chore>("/chores", input);
}

export function updateChore(id: string, input: ChoreInput) {
  return api.patch<Chore>(`/chores/${id}`, input);
}

export function deleteChore(id: string) {
  return api.delete<{ ok: boolean }>(`/chores/${id}`);
}

export function completeChore(id: string) {
  return api.post<ChoreCompletion | { ok: boolean; alreadyDone: boolean }>(`/chores/${id}/complete`);
}

export function uncompleteChore(id: string) {
  return api.post<{ ok: boolean }>(`/chores/${id}/uncomplete`);
}
