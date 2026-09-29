import type { Chore, Recurrence } from "@/types";
import { parseDueDate, parseRecurrenceDays, toDateInputValue } from "@/utils/recurrence";

export type ChoreFieldsValue = {
  title: string;
  description: string;
  points: number;
  assignedToUserId: string;
  recurrence: Recurrence;
  dueDate: string;
  recurrenceDays: number[];
};

export function defaultChoreFieldsValue(chore?: Chore): ChoreFieldsValue {
  if (!chore) {
    return {
      title: "",
      description: "",
      points: 0,
      assignedToUserId: "",
      recurrence: "none",
      dueDate: toDateInputValue(new Date()),
      recurrenceDays: [],
    };
  }
  return {
    title: chore.title,
    description: chore.description ?? "",
    points: chore.points,
    assignedToUserId: chore.assignedToUserId ?? "",
    recurrence: chore.recurrence,
    dueDate: toDateInputValue(parseDueDate(chore.dueDate)),
    recurrenceDays: parseRecurrenceDays(chore.recurrenceDays),
  };
}
