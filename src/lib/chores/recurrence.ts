export type Recurrence = "none" | "daily" | "weekly" | "weekdays" | "custom";

export type RecurrenceConfig = {
  recurrence: Recurrence;
  dueDate: Date;
  recurrenceDays: string | null;
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parseRecurrenceDays(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (day): day is number =>
        typeof day === "number" && day >= 0 && day <= 6,
    );
  } catch {
    return [];
  }
}

export function serializeRecurrenceDays(days: number[]): string {
  return JSON.stringify([...new Set(days)].sort((a, b) => a - b));
}

// A one-time chore is due only on its exact due date. Recurring chores never
// come due before their anchor date (dueDate doubles as the recurrence
// start), and weekly recurrence repeats on the anchor's weekday.
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
      return parseRecurrenceDays(chore.recurrenceDays).includes(
        target.getDay(),
      );
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

// Every date in [start, end] (inclusive) that the chore is due on —
// used to plot a chore across a calendar month.
export function dueDatesInRange(
  chore: RecurrenceConfig,
  start: Date,
  end: Date,
): Date[] {
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
