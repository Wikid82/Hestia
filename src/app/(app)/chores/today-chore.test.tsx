// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { TodayChore } from "./today-chore.tsx";

vi.mock("@/lib/actions/chores", () => ({
  completeChore: vi.fn(),
  uncompleteChore: vi.fn(),
}));

const chore = { id: "chore-1", title: "Take out trash", points: 5 };

test("shows the assignee name and points when unassigned action isn't allowed", () => {
  render(
    <TodayChore
      chore={chore}
      assignee={{ name: "Jeremy", avatarEmoji: "🙂" }}
      done={false}
      canAct={false}
    />,
  );

  expect(screen.getByText("Take out trash")).toBeInTheDocument();
  expect(screen.getByText(/🙂 Jeremy/)).toBeInTheDocument();
  expect(screen.getByText(/5 pts/)).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

test("shows 'Unassigned' when there's no assignee", () => {
  render(<TodayChore chore={chore} assignee={null} done={false} canAct={false} />);
  expect(screen.getByText(/Unassigned/)).toBeInTheDocument();
});

test("shows a Done button when actionable and not yet done", () => {
  render(<TodayChore chore={chore} assignee={null} done={false} canAct={true} />);
  expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
});

test("shows an Undo button and strikes the title when done", () => {
  render(<TodayChore chore={chore} assignee={null} done={true} canAct={true} />);
  expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  expect(screen.getByText("Take out trash")).toHaveClass("line-through");
});
