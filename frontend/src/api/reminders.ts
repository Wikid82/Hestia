import { api } from "./client";
import type { Reminder } from "@/types";

export function listReminders() {
  return api.get<{ reminders: Reminder[] }>("/reminders");
}

export type ReminderInput = {
  title: string;
  notes?: string | null;
  dueAt?: string; // YYYY-MM-DD
  assignedToUserId?: string | null;
};

export function createReminder(input: ReminderInput) {
  return api.post<Reminder>("/reminders", input);
}

export function toggleReminderDone(id: string) {
  return api.patch<Reminder>(`/reminders/${id}/toggle`);
}

export function deleteReminder(id: string) {
  return api.delete<{ ok: boolean }>(`/reminders/${id}`);
}
