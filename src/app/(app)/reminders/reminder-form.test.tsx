// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ReminderForm } from "./reminder-form.tsx";

vi.mock("@/lib/actions/reminders", () => ({
  createReminder: vi.fn(async () => null),
}));

const members = [
  { id: "u1", name: "Jeremy", avatarEmoji: "🙂" },
  { id: "u2", name: "Kid", avatarEmoji: "🧒" },
] as never;

test("renders title, notes, and due date fields", () => {
  render(<ReminderForm members={members} isAdmin={false} />);

  expect(screen.getByPlaceholderText("Title")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Notes (optional)")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Add reminder" }),
  ).toBeInTheDocument();
});

test("shows an assignee select listing household members for admins", () => {
  render(<ReminderForm members={members} isAdmin={true} />);

  expect(screen.getByRole("combobox")).toBeInTheDocument();
  expect(screen.getByText("Everyone")).toBeInTheDocument();
  expect(screen.getByText("🙂 Jeremy")).toBeInTheDocument();
  expect(screen.getByText("🧒 Kid")).toBeInTheDocument();
});

test("hides the assignee select for non-admins", () => {
  render(<ReminderForm members={members} isAdmin={false} />);

  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.queryByText("Everyone")).not.toBeInTheDocument();
});

test("shows an error message when the action returns one", async () => {
  const { createReminder } = await import("@/lib/actions/reminders");
  vi.mocked(createReminder).mockResolvedValueOnce({
    error: "Title is required.",
  });
  const user = userEvent.setup();
  render(<ReminderForm members={members} isAdmin={false} />);

  await user.type(screen.getByPlaceholderText("Title"), "Pack lunch");
  await user.click(screen.getByRole("button", { name: "Add reminder" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Title is required.",
  );
});
