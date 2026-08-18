import { useState } from "react";
import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { ChoreFields, defaultChoreFieldsValue, type ChoreFieldsValue } from "./ChoreFields";
import type { Chore, Profile } from "@/types";

const members: Profile[] = [
  {
    id: "u1",
    householdId: "h1",
    name: "Jeremy",
    avatarEmoji: "🙂",
    role: "hoh",
    isSystemAdmin: true,
    points: 0,
    createdAt: "2026-01-01",
    hasPin: false,
  },
];

function Wrapper({ initial }: { initial: ChoreFieldsValue }) {
  const [value, setValue] = useState(initial);
  return <ChoreFields members={members} value={value} onChange={setValue} />;
}

describe("defaultChoreFieldsValue", () => {
  it("returns blank defaults with no chore given", () => {
    const value = defaultChoreFieldsValue();
    expect(value.title).toBe("");
    expect(value.recurrence).toBe("none");
    expect(value.recurrenceDays).toEqual([]);
  });

  it("derives values from an existing chore", () => {
    const chore: Chore = {
      id: "c1",
      householdId: "h1",
      title: "Dishes",
      description: "Every night",
      points: 5,
      dueDate: "2026-08-20",
      recurrence: "custom",
      recurrenceDays: "[1,3,5]",
      assignedToUserId: "u1",
      isActive: true,
      createdAt: "2026-08-01",
      completedToday: false,
    };
    const value = defaultChoreFieldsValue(chore);
    expect(value.title).toBe("Dishes");
    expect(value.description).toBe("Every night");
    expect(value.assignedToUserId).toBe("u1");
    expect(value.recurrenceDays).toEqual([1, 3, 5]);
  });
});

describe("ChoreFields", () => {
  it("updates title, description, assignee, points and dueDate via onChange", async () => {
    const user = userEvent.setup();
    render(<Wrapper initial={defaultChoreFieldsValue()} />);

    await user.type(screen.getByPlaceholderText("Title"), "Vacuum");
    expect(screen.getByPlaceholderText("Title")).toHaveValue("Vacuum");

    await user.type(screen.getByPlaceholderText("Description (optional)"), "Living room");
    expect(screen.getByPlaceholderText("Description (optional)")).toHaveValue("Living room");

    await user.selectOptions(screen.getByDisplayValue("Assign to..."), "u1");
    await user.clear(screen.getByPlaceholderText("Points"));
    await user.type(screen.getByPlaceholderText("Points"), "3");
    expect(screen.getByPlaceholderText("Points")).toHaveValue(3);
  });

  it("shows weekday checkboxes only when recurrence is custom, and toggles days", async () => {
    const user = userEvent.setup();
    render(<Wrapper initial={defaultChoreFieldsValue()} />);

    expect(screen.queryByText("Mon")).not.toBeInTheDocument();

    const recurrenceSelect = screen.getByDisplayValue("One-time");
    await user.selectOptions(recurrenceSelect, "custom");

    const monCheckbox = screen.getByLabelText("Mon") as HTMLInputElement;
    expect(monCheckbox.checked).toBe(false);
    await user.click(monCheckbox);
    expect(monCheckbox.checked).toBe(true);
    await user.click(monCheckbox);
    expect(monCheckbox.checked).toBe(false);
  });
});
