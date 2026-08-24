import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { mockApi } from "@/test/mockApi";
import { RewardCard } from "./RewardCard";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderCard(userPoints: number) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RewardCard reward={{ id: "r1", title: "Movie night", description: "Pick any movie", pointCost: 20 }} userPoints={userPoints} />
    </QueryClientProvider>,
  );
}

describe("RewardCard", () => {
  it("shows Redeem and enables the button when affordable", () => {
    renderCard(30);
    expect(screen.getByRole("button", { name: "Redeem" })).not.toBeDisabled();
  });

  it("shows a disabled button when not affordable", () => {
    renderCard(5);
    expect(screen.getByRole("button", { name: "Not enough points" })).toBeDisabled();
  });

  it("redeems successfully on click", async () => {
    const user = userEvent.setup();
    mockApi({ "POST /api/rewards/r1/redeem": { body: { id: "red1" } } });
    renderCard(30);
    await user.click(screen.getByRole("button", { name: "Redeem" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("shows an error message when redemption fails", async () => {
    const user = userEvent.setup();
    mockApi({ "POST /api/rewards/r1/redeem": { status: 400, body: { error: "Not enough points" } } });
    renderCard(30);
    await user.click(screen.getByRole("button", { name: "Redeem" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Not enough points"));
  });
});
