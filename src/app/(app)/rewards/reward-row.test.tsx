// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { RewardRow } from "./reward-row.tsx";

vi.mock("@/lib/actions/rewards", () => ({
  deleteReward: vi.fn(async () => null),
  toggleRewardActive: vi.fn(async () => null),
  updateReward: vi.fn(async () => null),
}));

const reward = {
  id: "reward-1",
  title: "Movie night",
  description: "Pick the movie",
  pointCost: 20,
  isActive: true,
} as never;

test("shows the title and Archive action for an active reward", () => {
  render(<RewardRow reward={reward} />);
  expect(screen.getByText("Movie night")).toBeInTheDocument();
  expect(screen.queryByText(/archived/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
});

test("shows the archived label and Unarchive action for an inactive reward", () => {
  render(<RewardRow reward={{ ...reward, isActive: false }} />);
  expect(screen.getByText(/\(archived\)/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Unarchive" })).toBeInTheDocument();
});

test("switches to an edit form when Edit is clicked, and back on Cancel", async () => {
  const user = userEvent.setup();
  render(<RewardRow reward={reward} />);

  await user.click(screen.getByRole("button", { name: "Edit" }));
  expect(screen.getByDisplayValue("Movie night")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
});

test("calls toggleRewardActive when Archive is clicked", async () => {
  const { toggleRewardActive } = await import("@/lib/actions/rewards");
  const user = userEvent.setup();
  render(<RewardRow reward={reward} />);

  await user.click(screen.getByRole("button", { name: "Archive" }));
  expect(toggleRewardActive).toHaveBeenCalled();
});

test("calls deleteReward when Delete is clicked", async () => {
  const { deleteReward } = await import("@/lib/actions/rewards");
  const user = userEvent.setup();
  render(<RewardRow reward={reward} />);

  await user.click(screen.getByRole("button", { name: "Delete" }));
  expect(deleteReward).toHaveBeenCalled();
});
