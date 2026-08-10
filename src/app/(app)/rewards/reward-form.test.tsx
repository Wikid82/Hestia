// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { RewardForm } from "./reward-form.tsx";

vi.mock("@/lib/actions/rewards", () => ({
  createReward: vi.fn(async () => null),
}));

test("renders the title, description, and point cost fields", () => {
  render(<RewardForm />);
  expect(screen.getByPlaceholderText("Title")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Description (optional)")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Point cost")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add reward" })).toBeInTheDocument();
});

test("submits the action with the entered values", async () => {
  const { createReward } = await import("@/lib/actions/rewards");
  const user = userEvent.setup();
  render(<RewardForm />);

  await user.type(screen.getByPlaceholderText("Title"), "Ice cream trip");
  await user.type(screen.getByPlaceholderText("Point cost"), "15");
  await user.click(screen.getByRole("button", { name: "Add reward" }));

  expect(createReward).toHaveBeenCalled();
});

test("shows the error message returned by the action", async () => {
  const { createReward } = await import("@/lib/actions/rewards");
  vi.mocked(createReward).mockResolvedValueOnce({ error: "Title is required" });
  const user = userEvent.setup();
  render(<RewardForm />);

  await user.type(screen.getByPlaceholderText("Title"), "x");
  await user.type(screen.getByPlaceholderText("Point cost"), "5");
  await user.click(screen.getByRole("button", { name: "Add reward" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Title is required");
});
