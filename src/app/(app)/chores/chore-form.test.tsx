// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ChoreForm } from "./chore-form.tsx";

vi.mock("@/lib/actions/chores", () => ({
  createChore: vi.fn(async () => null),
}));

const members = [{ id: "u1", name: "Jeremy", avatarEmoji: "🙂" }] as never;

test("renders the chore fields and an enabled submit button", () => {
  render(<ChoreForm members={members} />);

  expect(screen.getByPlaceholderText("Title")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add chore" })).toBeEnabled();
});

test("submits the form and shows the error returned by createChore", async () => {
  const { createChore } = await import("@/lib/actions/chores");
  vi.mocked(createChore).mockResolvedValueOnce({ error: "Title is required" });
  const user = userEvent.setup();
  render(<ChoreForm members={members} />);

  await user.type(screen.getByPlaceholderText("Title"), "Dishes");
  const [assigneeSelect] = screen.getAllByRole("combobox");
  await user.selectOptions(assigneeSelect, "u1");
  await user.click(screen.getByRole("button", { name: "Add chore" }));

  expect(createChore).toHaveBeenCalled();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Title is required",
  );
});

test("shows no error message before the form has been submitted", () => {
  render(<ChoreForm members={members} />);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
