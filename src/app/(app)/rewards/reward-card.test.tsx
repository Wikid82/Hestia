// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { RewardCard } from "./reward-card.tsx";

vi.mock("@/lib/actions/rewards", () => ({
  redeemReward: vi.fn(async () => null),
}));

const reward = {
  id: "reward-1",
  title: "Movie night",
  description: "Pick the movie",
  pointCost: 20,
};

test("renders title, description, and point cost", () => {
  render(<RewardCard reward={reward} userPoints={50} />);
  expect(screen.getByText("Movie night")).toBeInTheDocument();
  expect(screen.getByText("Pick the movie")).toBeInTheDocument();
  expect(screen.getByText("20 pts")).toBeInTheDocument();
});

test("omits the description paragraph when there is none", () => {
  render(<RewardCard reward={{ ...reward, description: null }} userPoints={50} />);
  expect(screen.queryByText("Pick the movie")).not.toBeInTheDocument();
});

test("shows an enabled Redeem button when affordable", () => {
  render(<RewardCard reward={reward} userPoints={50} />);
  expect(screen.getByRole("button", { name: "Redeem" })).toBeEnabled();
});

test("shows a disabled button with a warning label when not affordable", () => {
  render(<RewardCard reward={reward} userPoints={5} />);
  expect(screen.getByRole("button", { name: "Not enough points" })).toBeDisabled();
});

test("shows the error message returned by the action", async () => {
  const { redeemReward } = await import("@/lib/actions/rewards");
  vi.mocked(redeemReward).mockResolvedValueOnce({ error: "Something went wrong" });
  const user = userEvent.setup();
  render(<RewardCard reward={reward} userPoints={50} />);

  await user.click(screen.getByRole("button", { name: "Redeem" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong");
});
