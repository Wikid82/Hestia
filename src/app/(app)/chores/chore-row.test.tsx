// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ChoreRow } from "./chore-row.tsx";

vi.mock("@/lib/actions/chores", () => ({
  deleteChore: vi.fn(async () => undefined),
  updateChore: vi.fn(async () => null),
}));

const members = [{ id: "u1", name: "Jeremy", avatarEmoji: "🙂" }] as never;

const chore = {
  id: "chore-1",
  title: "Take out trash",
  description: null,
  points: 5,
  dueDate: new Date(2026, 7, 10),
  recurrence: "daily",
  recurrenceDays: null,
  assignedToUserId: "u1",
} as never;

test("shows the chore summary with assignee, points, and recurrence", () => {
  render(<ChoreRow chore={chore} members={members} />);

  expect(screen.getByText("Take out trash")).toBeInTheDocument();
  expect(screen.getByText(/🙂 Jeremy/)).toBeInTheDocument();
  expect(screen.getByText(/5 pts/)).toBeInTheDocument();
  expect(screen.getByText(/Daily/)).toBeInTheDocument();
  expect(screen.queryByPlaceholderText("Title")).not.toBeInTheDocument();
});

test("shows 'Unassigned' when no member matches the chore", () => {
  render(
    <ChoreRow chore={{ ...chore, assignedToUserId: null }} members={members} />,
  );
  expect(screen.getByText(/Unassigned/)).toBeInTheDocument();
});

test("switches to a pre-filled edit form when Edit is clicked", async () => {
  const user = userEvent.setup();
  render(<ChoreRow chore={chore} members={members} />);

  await user.click(screen.getByRole("button", { name: "Edit" }));

  expect(screen.getByPlaceholderText("Title")).toHaveValue("Take out trash");
  expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Edit" }),
  ).not.toBeInTheDocument();
});

test("Cancel returns to the summary view", async () => {
  const user = userEvent.setup();
  render(<ChoreRow chore={chore} members={members} />);

  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.click(screen.getByRole("button", { name: "Cancel" }));

  expect(screen.queryByPlaceholderText("Title")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
});

test("shows the error returned by updateChore after saving", async () => {
  const { updateChore } = await import("@/lib/actions/chores");
  vi.mocked(updateChore).mockResolvedValueOnce({
    error: "Points must be positive",
  });
  const user = userEvent.setup();
  render(<ChoreRow chore={chore} members={members} />);

  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.click(screen.getByRole("button", { name: "Save" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Points must be positive",
  );
});

test("submits deleteChore when Delete is clicked", async () => {
  const { deleteChore } = await import("@/lib/actions/chores");
  const user = userEvent.setup();
  render(<ChoreRow chore={chore} members={members} />);

  await user.click(screen.getByRole("button", { name: "Delete" }));

  expect(deleteChore).toHaveBeenCalled();
});
