// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { ChoreFields } from "./chore-fields.tsx";

const members = [
  { id: "u1", name: "Jeremy", avatarEmoji: "🙂" },
  { id: "u2", name: "Kid", avatarEmoji: "🧒" },
] as never;

test("renders member options and hides custom days by default", () => {
  render(<ChoreFields members={members} />);

  expect(screen.getByText("🙂 Jeremy")).toBeInTheDocument();
  expect(screen.getByText("🧒 Kid")).toBeInTheDocument();
  expect(screen.queryByText("Sun")).not.toBeInTheDocument();
});

test("reveals weekday checkboxes when custom recurrence is chosen", async () => {
  const user = userEvent.setup();
  render(<ChoreFields members={members} />);

  const [, recurrenceSelect] = screen.getAllByRole("combobox");
  await user.selectOptions(recurrenceSelect, "custom");
  expect(screen.getByText("Sun")).toBeInTheDocument();
  expect(screen.getByText("Sat")).toBeInTheDocument();
});

test("pre-fills defaults, including previously selected custom days", () => {
  render(
    <ChoreFields
      members={members}
      defaults={{
        title: "Dishes",
        description: "After dinner",
        points: 5,
        assignedToUserId: "u1",
        recurrence: "custom",
        recurrenceDays: "[1,3]",
        dueDate: new Date(2026, 7, 12),
      }}
    />,
  );

  expect(screen.getByPlaceholderText("Title")).toHaveValue("Dishes");
  expect(screen.getByPlaceholderText("Description (optional)")).toHaveValue(
    "After dinner",
  );
  const mon = screen.getByLabelText("Mon") as HTMLInputElement;
  const tue = screen.getByLabelText("Tue") as HTMLInputElement;
  expect(mon.checked).toBe(true);
  expect(tue.checked).toBe(false);
});
