import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { chores, reminders } from "@/db/schema";
import { requireActiveUser } from "@/lib/auth/current-user";
import { dueDatesInRange } from "@/lib/chores/recurrence";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function buildMonthGrid(year: number, month: number): (Date | null)[][] {
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();

  const cells: (Date | null)[] = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { household } = await requireActiveUser();
  const params = await searchParams;

  const now = new Date();
  const [year, month] = params.month
    ? params.month.split("-").map(Number)
    : [now.getFullYear(), now.getMonth() + 1];
  const monthIndex = month - 1;

  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  const weeks = buildMonthGrid(year, monthIndex);

  const [allChores, dueReminders] = await Promise.all([
    db.query.chores.findMany({ where: eq(chores.householdId, household.id) }),
    db.query.reminders.findMany({ where: eq(reminders.householdId, household.id) }),
  ]);

  const choresByDay = new Map<string, string[]>();
  for (const chore of allChores) {
    const dates = dueDatesInRange(
      {
        recurrence: chore.recurrence,
        dueDate: chore.dueDate,
        recurrenceDays: chore.recurrenceDays,
      },
      monthStart,
      monthEnd,
    );
    for (const date of dates) {
      const key = dateKey(date);
      choresByDay.set(key, [...(choresByDay.get(key) ?? []), chore.title]);
    }
  }

  const remindersByDay = new Map<string, string[]>();
  for (const reminder of dueReminders) {
    if (!reminder.dueAt) continue;
    if (reminder.dueAt < monthStart || reminder.dueAt > monthEnd) continue;
    const key = dateKey(reminder.dueAt);
    remindersByDay.set(key, [
      ...(remindersByDay.get(key) ?? []),
      reminder.title,
    ]);
  }

  const prevMonth = new Date(year, monthIndex - 1, 1);
  const nextMonth = new Date(year, monthIndex + 1, 1);
  const toParam = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}`;
  const todayKey = dateKey(new Date());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {MONTH_LABELS[monthIndex]} {year}
        </h1>
        <div className="flex gap-3 text-sm">
          <Link
            href={`/calendar?month=${toParam(prevMonth)}`}
            className="text-muted-foreground hover:text-foreground"
          >
            ← Prev
          </Link>
          <Link
            href={`/calendar?month=${toParam(nextMonth)}`}
            className="text-muted-foreground hover:text-foreground"
          >
            Next →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-xs">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-surface p-1.5 text-center font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}

        {weeks.flatMap((week, weekIndex) =>
          week.map((date, dayIndex) => {
            const key = date ? dateKey(date) : `blank-${weekIndex}-${dayIndex}`;
            const dayChores = date ? choresByDay.get(dateKey(date)) : undefined;
            const dayReminders = date
              ? remindersByDay.get(dateKey(date))
              : undefined;

            return (
              <div
                key={key}
                className={`min-h-20 space-y-1 bg-background p-1.5 ${
                  date && dateKey(date) === todayKey
                    ? "ring-1 ring-inset ring-primary"
                    : ""
                }`}
              >
                {date && (
                  <>
                    <p className="text-muted-foreground">{date.getDate()}</p>
                    {dayChores?.map((title, i) => (
                      <p
                        key={`c${i}`}
                        className="truncate rounded bg-surface px-1 py-0.5"
                        title={title}
                      >
                        {title}
                      </p>
                    ))}
                    {dayReminders?.map((title, i) => (
                      <p
                        key={`r${i}`}
                        className="truncate rounded bg-highlight px-1 py-0.5 text-highlight-foreground"
                        title={title}
                      >
                        {title}
                      </p>
                    ))}
                  </>
                )}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
