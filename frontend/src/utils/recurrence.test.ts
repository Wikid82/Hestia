import { describe, expect, it } from "vitest";
import {
  describeRecurrence,
  dueDatesInRange,
  isChoreDueOn,
  isChoreDueToday,
  parseDueDate,
  parseRecurrenceDays,
  serializeRecurrenceDays,
  toDateInputValue,
  type RecurrenceConfig,
} from "./recurrence";

// Mirrors backend/internal/services/recurrence_test.go — this is a
// faithful JS port of that Go logic, so the test cases (and the Monday
// anchor date) match 1:1.

function date(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

describe("parseRecurrenceDays", () => {
  it.each([
    ["nil", undefined, []],
    ["empty string", "", []],
    ["null", null, []],
    ["valid", "[1,3,5]", [1, 3, 5]],
    ["out of range dropped", "[-1,0,6,7]", [0, 6]],
    ["malformed json", "not json", []],
    ["not an array", '{"a":1}', []],
  ] as const)("%s", (_name, raw, want) => {
    expect(parseRecurrenceDays(raw)).toEqual(want);
  });
});

describe("serializeRecurrenceDays", () => {
  it("empty", () => {
    expect(serializeRecurrenceDays([])).toBe("[]");
  });
  it("dedupes and sorts", () => {
    expect(serializeRecurrenceDays([5, 1, 1, 3])).toBe("[1,3,5]");
  });
  it("single", () => {
    expect(serializeRecurrenceDays([2])).toBe("[2]");
  });
});

describe("isChoreDueOn", () => {
  const anchor = date(2026, 8, 17); // a Monday

  const cases: [string, RecurrenceConfig, Date, boolean][] = [
    ["none: exact due date", { recurrence: "none", dueDate: anchor, recurrenceDays: null }, anchor, true],
    [
      "none: different date",
      { recurrence: "none", dueDate: anchor, recurrenceDays: null },
      date(2026, 8, 18),
      false,
    ],
    ["daily: on anchor", { recurrence: "daily", dueDate: anchor, recurrenceDays: null }, anchor, true],
    [
      "daily: well after anchor",
      { recurrence: "daily", dueDate: anchor, recurrenceDays: null },
      date(2026, 9, 16),
      true,
    ],
    [
      "daily: before anchor never due",
      { recurrence: "daily", dueDate: anchor, recurrenceDays: null },
      date(2026, 8, 16),
      false,
    ],
    [
      "weekly: same weekday next week",
      { recurrence: "weekly", dueDate: anchor, recurrenceDays: null },
      date(2026, 8, 24),
      true,
    ],
    [
      "weekly: different weekday",
      { recurrence: "weekly", dueDate: anchor, recurrenceDays: null },
      date(2026, 8, 18),
      false,
    ],
    ["weekdays: Monday", { recurrence: "weekdays", dueDate: anchor, recurrenceDays: null }, date(2026, 8, 17), true],
    [
      "weekdays: Saturday excluded",
      { recurrence: "weekdays", dueDate: anchor, recurrenceDays: null },
      date(2026, 8, 22),
      false,
    ],
    [
      "weekdays: Sunday excluded",
      { recurrence: "weekdays", dueDate: anchor, recurrenceDays: null },
      date(2026, 8, 23),
      false,
    ],
    [
      "custom: matches one of the configured days",
      { recurrence: "custom", dueDate: anchor, recurrenceDays: "[1,3]" }, // Mon, Wed
      date(2026, 8, 19), // Wednesday
      true,
    ],
    [
      "custom: does not match",
      { recurrence: "custom", dueDate: anchor, recurrenceDays: "[1,3]" },
      date(2026, 8, 20), // Thursday
      false,
    ],
    [
      "custom: no days configured never due",
      { recurrence: "custom", dueDate: anchor, recurrenceDays: null },
      anchor,
      false,
    ],
  ];

  it.each(cases)("%s", (_name, config, target, want) => {
    expect(isChoreDueOn(config, target)).toBe(want);
  });
});

describe("isChoreDueToday", () => {
  it("a daily chore anchored well in the past is always due today", () => {
    const config: RecurrenceConfig = { recurrence: "daily", dueDate: date(2000, 1, 1), recurrenceDays: null };
    expect(isChoreDueToday(config)).toBe(true);
  });
});

describe("describeRecurrence", () => {
  const anchor = date(2026, 8, 17); // Monday

  it("daily", () => {
    expect(describeRecurrence({ recurrence: "daily", dueDate: anchor, recurrenceDays: null })).toBe("Daily");
  });
  it("weekly", () => {
    expect(describeRecurrence({ recurrence: "weekly", dueDate: anchor, recurrenceDays: null })).toBe(
      "Weekly (Mon)",
    );
  });
  it("weekdays", () => {
    expect(describeRecurrence({ recurrence: "weekdays", dueDate: anchor, recurrenceDays: null })).toBe("Weekdays");
  });
  it("custom with days", () => {
    expect(describeRecurrence({ recurrence: "custom", dueDate: anchor, recurrenceDays: "[1,3,5]" })).toBe(
      "Custom (Mon, Wed, Fri)",
    );
  });
});

describe("dueDatesInRange", () => {
  const anchor = date(2026, 8, 17); // Monday

  it("weekly within a two week range hits exactly twice", () => {
    const got = dueDatesInRange(
      { recurrence: "weekly", dueDate: anchor, recurrenceDays: null },
      anchor,
      date(2026, 8, 30),
    );
    expect(got.map((d) => d.getTime())).toEqual([anchor.getTime(), date(2026, 8, 24).getTime()]);
  });

  it("range entirely before anchor returns nothing", () => {
    const got = dueDatesInRange(
      { recurrence: "daily", dueDate: anchor, recurrenceDays: null },
      date(2026, 8, 7),
      date(2026, 8, 16),
    );
    expect(got).toEqual([]);
  });

  it("one-time chore returns at most one date", () => {
    const got = dueDatesInRange(
      { recurrence: "none", dueDate: anchor, recurrenceDays: null },
      date(2026, 8, 12),
      date(2026, 8, 22),
    );
    expect(got).toHaveLength(1);
    expect(got[0].getTime()).toBe(anchor.getTime());
  });
});

describe("parseDueDate", () => {
  it("parses a YYYY-MM-DD date string as a local calendar date", () => {
    const parsed = parseDueDate("2026-08-17");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(7); // 0-indexed
    expect(parsed.getDate()).toBe(17);
  });

  it("truncates a full ISO timestamp to just the date part", () => {
    const parsed = parseDueDate("2026-08-17T15:30:00.000Z");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(7);
    expect(parsed.getDate()).toBe(17);
  });
});

describe("toDateInputValue", () => {
  it("formats as YYYY-MM-DD with zero-padding", () => {
    expect(toDateInputValue(date(2026, 1, 5))).toBe("2026-01-05");
  });

  it("round-trips with parseDueDate", () => {
    const original = "2026-08-17";
    expect(toDateInputValue(parseDueDate(original))).toBe(original);
  });
});
