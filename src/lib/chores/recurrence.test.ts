import assert from "node:assert/strict";
import { test } from "node:test";
import {
  dueDatesInRange,
  isChoreDueOn,
  parseRecurrenceDays,
  serializeRecurrenceDays,
} from "./recurrence.ts";

// 2026-08-05 is a Wednesday.
const WEDNESDAY = new Date(2026, 7, 5);
const THURSDAY = new Date(2026, 7, 6);
const NEXT_WEDNESDAY = new Date(2026, 7, 12);
const PRIOR_TUESDAY = new Date(2026, 7, 4);

test("none: due only on its exact date", () => {
  const chore = { recurrence: "none" as const, dueDate: WEDNESDAY, recurrenceDays: null };
  assert.equal(isChoreDueOn(chore, WEDNESDAY), true);
  assert.equal(isChoreDueOn(chore, THURSDAY), false);
  assert.equal(isChoreDueOn(chore, NEXT_WEDNESDAY), false);
});

test("daily: due every day on/after the anchor, never before", () => {
  const chore = { recurrence: "daily" as const, dueDate: WEDNESDAY, recurrenceDays: null };
  assert.equal(isChoreDueOn(chore, WEDNESDAY), true);
  assert.equal(isChoreDueOn(chore, THURSDAY), true);
  assert.equal(isChoreDueOn(chore, NEXT_WEDNESDAY), true);
  assert.equal(isChoreDueOn(chore, PRIOR_TUESDAY), false);
});

test("weekly: due on the anchor's weekday, on/after the anchor", () => {
  const chore = { recurrence: "weekly" as const, dueDate: WEDNESDAY, recurrenceDays: null };
  assert.equal(isChoreDueOn(chore, WEDNESDAY), true);
  assert.equal(isChoreDueOn(chore, THURSDAY), false);
  assert.equal(isChoreDueOn(chore, NEXT_WEDNESDAY), true);
  assert.equal(isChoreDueOn(chore, PRIOR_TUESDAY), false);
});

test("weekdays: due Mon-Fri only, on/after the anchor", () => {
  const chore = { recurrence: "weekdays" as const, dueDate: WEDNESDAY, recurrenceDays: null };
  const saturday = new Date(2026, 7, 8);
  const sunday = new Date(2026, 7, 9);
  assert.equal(isChoreDueOn(chore, WEDNESDAY), true);
  assert.equal(isChoreDueOn(chore, THURSDAY), true);
  assert.equal(isChoreDueOn(chore, saturday), false);
  assert.equal(isChoreDueOn(chore, sunday), false);
});

test("custom: due on the configured weekdays only", () => {
  const chore = {
    recurrence: "custom" as const,
    dueDate: WEDNESDAY,
    recurrenceDays: serializeRecurrenceDays([1, 3]), // Mon, Wed
  };
  const monday = new Date(2026, 7, 10);
  assert.equal(isChoreDueOn(chore, WEDNESDAY), true);
  assert.equal(isChoreDueOn(chore, THURSDAY), false);
  assert.equal(isChoreDueOn(chore, monday), true);
});

test("parseRecurrenceDays: ignores malformed input rather than throwing", () => {
  assert.deepEqual(parseRecurrenceDays(null), []);
  assert.deepEqual(parseRecurrenceDays("not json"), []);
  assert.deepEqual(parseRecurrenceDays("[1,2,9,-1,3]"), [1, 2, 3]);
});

test("dueDatesInRange: collects every due date across a span", () => {
  const chore = { recurrence: "weekly" as const, dueDate: WEDNESDAY, recurrenceDays: null };
  const rangeStart = new Date(2026, 7, 1);
  const rangeEnd = new Date(2026, 7, 20);
  const dates = dueDatesInRange(chore, rangeStart, rangeEnd);
  assert.deepEqual(
    dates.map((d) => d.getDate()),
    [5, 12, 19],
  );
});
