// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ReminderItem } from "./reminder-item.tsx";

vi.mock("@/lib/actions/reminders", () => ({
  toggleReminderDone: vi.fn(async () => undefined),
  deleteReminder: vi.fn(async () => undefined),
}));

const reminder = {
  id: "r1",
  title: "Pack lunch",
  notes: "Don't forget the fruit",
  dueAt: new Date(2026, 7, 12),
  isDone: false,
};

test("shows title, notes, assignee, and due date", () => {
  render(
    <ReminderItem
      reminder={reminder}
      assignee={{ name: "Jeremy", avatarEmoji: "🙂" }}
      canDelete={false}
    />,
  );

  expect(screen.getByText("Pack lunch")).toBeInTheDocument();
  expect(screen.getByText("Don't forget the fruit")).toBeInTheDocument();
  expect(screen.getByText(/🙂 Jeremy/)).toBeInTheDocument();
  expect(
    screen.getByText(new RegExp(reminder.dueAt.toLocaleDateString())),
  ).toBeInTheDocument();
});

test("shows 'Everyone' when there's no assignee", () => {
  render(
    <ReminderItem reminder={reminder} assignee={null} canDelete={false} />,
  );

  expect(screen.getByText(/Everyone/)).toBeInTheDocument();
});

test("hides the Delete button when canDelete is false", () => {
  render(
    <ReminderItem reminder={reminder} assignee={null} canDelete={false} />,
  );

  expect(
    screen.queryByRole("button", { name: "Delete" }),
  ).not.toBeInTheDocument();
});

test("shows the Delete button when canDelete is true", () => {
  render(
    <ReminderItem reminder={reminder} assignee={null} canDelete={true} />,
  );

  expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
});

test("marks a done reminder with strikethrough and an unmark label", () => {
  render(
    <ReminderItem
      reminder={{ ...reminder, isDone: true }}
      assignee={null}
      canDelete={false}
    />,
  );

  expect(screen.getByText("Pack lunch")).toHaveClass("line-through");
  expect(
    screen.getByRole("button", { name: "Mark not done" }),
  ).toBeInTheDocument();
});

test("shows a mark-done label when not yet done", () => {
  render(
    <ReminderItem reminder={reminder} assignee={null} canDelete={false} />,
  );

  expect(screen.getByText("Pack lunch")).not.toHaveClass("line-through");
  expect(
    screen.getByRole("button", { name: "Mark done" }),
  ).toBeInTheDocument();
});
