import { useState } from "react";
import type { Chore, Profile, Recurrence } from "@/types";
import { parseDueDate, parseRecurrenceDays, toDateInputValue } from "@/utils/recurrence";

const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

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

export function ChoreFields({
  members,
  value,
  onChange,
}: {
  members: Profile[];
  value: ChoreFieldsValue;
  onChange: (value: ChoreFieldsValue) => void;
}) {
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set(value.recurrenceDays));

  function toggleDay(day: number) {
    const next = new Set(selectedDays);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    setSelectedDays(next);
    onChange({ ...value, recurrenceDays: [...next] });
  }

  return (
    <>
      <input
        name="title"
        type="text"
        required
        placeholder="Title"
        value={value.title}
        onChange={(e) => onChange({ ...value, title: e.target.value })}
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />
      <textarea
        name="description"
        placeholder="Description (optional)"
        value={value.description}
        onChange={(e) => onChange({ ...value, description: e.target.value })}
        rows={2}
        className="w-full rounded-md border border-border px-3 py-2 text-sm"
      />

      <div className="flex gap-2">
        <select
          name="assignedToUserId"
          required
          value={value.assignedToUserId}
          onChange={(e) => onChange({ ...value, assignedToUserId: e.target.value })}
          className="flex-1 rounded-md border border-border px-2 py-2 text-sm"
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
          value={value.points}
          onChange={(e) => onChange({ ...value, points: Number(e.target.value) })}
          className="w-24 rounded-md border border-border px-2 py-2 text-sm"
        />
      </div>

      <div className="flex gap-2">
        <select
          name="recurrence"
          value={value.recurrence}
          onChange={(e) => onChange({ ...value, recurrence: e.target.value as Recurrence })}
          className="flex-1 rounded-md border border-border px-2 py-2 text-sm"
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
          value={value.dueDate}
          onChange={(e) => onChange({ ...value, dueDate: e.target.value })}
          className="flex-1 rounded-md border border-border px-2 py-2 text-sm"
        />
      </div>

      {value.recurrence === "custom" && (
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((day) => (
            <label key={day.value} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={selectedDays.has(day.value)}
                onChange={() => toggleDay(day.value)}
              />
              {day.label}
            </label>
          ))}
        </div>
      )}
    </>
  );
}
