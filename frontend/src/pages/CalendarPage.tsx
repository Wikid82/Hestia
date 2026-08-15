import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { listChores } from "@/api/chores";
import { listReminders } from "@/api/reminders";
import { dueDatesInRange, parseDueDate } from "@/utils/recurrence";

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

export default function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const choresQuery = useQuery({ queryKey: ["chores", "all"], queryFn: () => listChores(false) });
  const remindersQuery = useQuery({ queryKey: ["reminders"], queryFn: listReminders });

  const now = new Date();
  const monthParam = searchParams.get("month");
  const [paramYear, paramMonth] = monthParam ? monthParam.split("-") : [];
  const year = paramYear ? Number(paramYear) : now.getFullYear();
  const monthIndex = paramMonth ? Number(paramMonth) - 1 : now.getMonth();

  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0);
  const weeks = buildMonthGrid(year, monthIndex);

  const choresByDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const chore of choresQuery.data?.chores ?? []) {
      const dates = dueDatesInRange(
        {
          recurrence: chore.recurrence,
          dueDate: parseDueDate(chore.dueDate),
          recurrenceDays: chore.recurrenceDays,
        },
        monthStart,
        monthEnd,
      );
      for (const date of dates) {
        const key = dateKey(date);
        map.set(key, [...(map.get(key) ?? []), chore.title]);
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choresQuery.data, year, monthIndex]);

  const remindersByDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const reminder of remindersQuery.data?.reminders ?? []) {
      if (!reminder.dueAt) continue;
      const due = parseDueDate(reminder.dueAt);
      if (due < monthStart || due > monthEnd) continue;
      const key = dateKey(due);
      map.set(key, [...(map.get(key) ?? []), reminder.title]);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remindersQuery.data, year, monthIndex]);

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
          <button
            onClick={() => setSearchParams({ month: toParam(prevMonth) })}
            className="text-muted-foreground hover:text-foreground"
          >
            ← Prev
          </button>
          <button
            onClick={() => setSearchParams({ month: toParam(nextMonth) })}
            className="text-muted-foreground hover:text-foreground"
          >
            Next →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-xs">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="bg-surface p-1.5 text-center font-medium text-muted-foreground">
            {label}
          </div>
        ))}

        {weeks.flatMap((week, weekIndex) =>
          week.map((date, dayIndex) => {
            const key = date ? dateKey(date) : `blank-${weekIndex}-${dayIndex}`;
            const dayChores = date ? choresByDay.get(dateKey(date)) : undefined;
            const dayReminders = date ? remindersByDay.get(dateKey(date)) : undefined;

            return (
              <div
                key={key}
                className={`min-h-20 space-y-1 bg-background p-1.5 ${
                  date && dateKey(date) === todayKey ? "ring-1 ring-inset ring-primary" : ""
                }`}
              >
                {date && (
                  <>
                    <p className="text-muted-foreground">{date.getDate()}</p>
                    {dayChores?.map((title, i) => (
                      <p key={`c${i}`} className="truncate rounded bg-surface px-1 py-0.5" title={title}>
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
