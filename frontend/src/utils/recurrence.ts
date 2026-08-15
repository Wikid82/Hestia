// Ported from src/lib/chores/recurrence.ts (old Next.js app). Kept
// faithful to the original semantics: dueDate doubles as the recurrence
// start / anchor date; a one-time ("none") chore is due only on that date.
import type { Recurrence } from "@/types";

export type RecurrenceConfig = {
  recurrence: Recurrence;
  dueDate: Date;
  recurrenceDays: string | null | undefined;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parseRecurrenceDays(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (day): day is number => typeof day === "number" && day >= 0 && day <= 6,
    );
  } catch {
    return [];
  }
}

export function serializeRecurrenceDays(days: number[]): string {
  return JSON.stringify([...new Set(days)].sort((a, b) => a - b));
}

export function isChoreDueOn(chore: RecurrenceConfig, date: Date): boolean {
  const target = startOfDay(date);
  const anchor = startOfDay(chore.dueDate);

  if (chore.recurrence === "none") {
    return target.getTime() === anchor.getTime();
  }

  if (target.getTime() < anchor.getTime()) return false;

  switch (chore.recurrence) {
    case "daily":
      return true;
    case "weekly":
      return target.getDay() === anchor.getDay();
    case "weekdays":
      return target.getDay() >= 1 && target.getDay() <= 5;
    case "custom":
      return parseRecurrenceDays(chore.recurrenceDays).includes(target.getDay());
    default:
      return false;
  }
}

export function isChoreDueToday(chore: RecurrenceConfig): boolean {
  return isChoreDueOn(chore, new Date());
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function describeRecurrence(chore: RecurrenceConfig): string {
  switch (chore.recurrence) {
    case "none":
      return `One-time (${chore.dueDate.toLocaleDateString()})`;
    case "daily":
      return "Daily";
    case "weekly":
      return `Weekly (${WEEKDAY_LABELS[chore.dueDate.getDay()]})`;
    case "weekdays":
      return "Weekdays";
    case "custom":
      return `Custom (${parseRecurrenceDays(chore.recurrenceDays)
        .map((day) => WEEKDAY_LABELS[day])
        .join(", ")})`;
    default:
      return chore.recurrence;
  }
}

export function dueDatesInRange(chore: RecurrenceConfig, start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cursor = startOfDay(start);
  const last = startOfDay(end);

  while (cursor.getTime() <= last.getTime()) {
    if (isChoreDueOn(chore, cursor)) {
      dates.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

// Parses the backend's "YYYY-MM-DD" (or full ISO) dueDate string as a
// local calendar date, matching how the old Drizzle schema stored it.
export function parseDueDate(raw: string): Date {
  const datePart = raw.slice(0, 10);
  const [year, month, day] = datePart.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
