import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockApi } from "@/test/mockApi";
import { RewardRow } from "./RewardRow";
import type { Reward } from "@/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

const reward: Reward = {
  id: "rw1",
  householdId: "h1",
  title: "Movie night",
  description: "Pick any movie",
  pointCost: 20,
  isActive: true,
  createdAt: "2026-08-01",
};

function renderRow(r: Reward = reward) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RewardRow reward={r} />
    </QueryClientProvider>,
  );
}

describe("RewardRow", () => {
  it("shows title and point cost, and marks archived rewards", () => {
    renderRow({ ...reward, isActive: false });
    expect(screen.getByText(/Movie night/)).toBeInTheDocument();
    expect(screen.getByText(/\(archived\)/)).toBeInTheDocument();
  });

  it("enters edit mode and cancels", async () => {
    const user = userEvent.setup();
    renderRow();
    await user.click(screen.getByText("Edit"));
    expect(screen.getByDisplayValue("Movie night")).toBeInTheDocument();
    await user.click(screen.getByText("Cancel"));
    expect(screen.queryByDisplayValue("Movie night")).not.toBeInTheDocument();
  });

  it("saves an edit", async () => {
    const user = userEvent.setup();
    mockApi({ "PATCH /api/rewards/rw1": { body: { ...reward, title: "Game night" } } });
    renderRow();
    await user.click(screen.getByText("Edit"));
    const titleInput = screen.getByDisplayValue("Movie night");
    await user.clear(titleInput);
    await user.type(titleInput, "Game night");
    await user.click(screen.getByText("Save"));
    await waitFor(() => expect(screen.queryByDisplayValue("Game night")).not.toBeInTheDocument());
  });

  it("shows an error when save fails", async () => {
    const user = userEvent.setup();
    mockApi({ "PATCH /api/rewards/rw1": { status: 400, body: { error: "Title required" } } });
    renderRow();
    await user.click(screen.getByText("Edit"));
    await user.click(screen.getByText("Save"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Title required"));
  });

  it("toggles active state, showing Unarchive for an archived reward", () => {
    renderRow({ ...reward, isActive: false });
    expect(screen.getByText("Unarchive")).toBeInTheDocument();
  });

  it("archives an active reward on click", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ "PATCH /api/rewards/rw1/toggle": { body: { ...reward, isActive: false } } });
    renderRow();
    await user.click(screen.getByText("Archive"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/rewards/rw1/toggle",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
  });

  it("deletes on click", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ "DELETE /api/rewards/rw1": { body: { ok: true } } });
    renderRow();
    await user.click(screen.getByText("Delete"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/rewards/rw1", expect.objectContaining({ method: "DELETE" })),
    );
  });
});
