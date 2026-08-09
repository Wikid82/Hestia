"use client";

import { useState } from "react";
import type { users } from "@/db/schema";

type Member = typeof users.$inferSelect;
type Recurrence = "none" | "daily" | "weekly" | "weekdays" | "custom";

const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ChoreFields({
  members,
  defaults,
}: {
  members: Member[];
  defaults?: {
    title: string;
    description: string | null;
    points: number;
    assignedToUserId: string | null;
    recurrence: Recurrence;
    recurrenceDays: string | null;
    dueDate: Date;
  };
}) {
  const [recurrence, setRecurrence] = useState<Recurrence>(
    defaults?.recurrence ?? "none",
  );
  const selectedDays = new Set(
    defaults?.recurrenceDays
      ? (JSON.parse(defaults.recurrenceDays) as number[])
      : [],
  );

  return (
    <>
      <input
        name="title"
        type="text"
        required
        placeholder="Title"
        defaultValue={defaults?.title}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      <textarea
        name="description"
        placeholder="Description (optional)"
        defaultValue={defaults?.description ?? ""}
        rows={2}
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />

      <div className="flex gap-2">
        <select
          name="assignedToUserId"
          required
          defaultValue={defaults?.assignedToUserId ?? ""}
          className="flex-1 rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="" disabled>
            Assign to...
          </option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.avatarEmoji} {member.name}
            </option>
          ))}
        </select>
        <input
          name="points"
          type="number"
          min={0}
          required
          placeholder="Points"
          defaultValue={defaults?.points ?? 0}
          className="w-24 rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      <div className="flex gap-2">
        <select
          name="recurrence"
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as Recurrence)}
          className="flex-1 rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        >
          <option value="none">One-time</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="weekdays">Weekdays</option>
          <option value="custom">Custom days</option>
        </select>
        <input
          name="dueDate"
          type="date"
          required
          defaultValue={toDateInputValue(defaults?.dueDate ?? new Date())}
          className="flex-1 rounded-md border border-neutral-300 px-2 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </div>

      {recurrence === "custom" && (
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <label
              key={day.value}
              className="flex items-center gap-1 text-xs"
            >
              <input
                type="checkbox"
                name="recurrenceDays"
                value={day.value}
                defaultChecked={selectedDays.has(day.value)}
              />
              {day.label}
            </label>
          ))}
        </div>
      )}
    </>
  );
}
