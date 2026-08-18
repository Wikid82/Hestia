import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { mockApi } from "@/test/mockApi";
import { renderWithProviders } from "@/test/render";
import RewardsPage from "./RewardsPage";
import type { Household, Profile } from "@/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

const household: Household = { id: "h1", name: "Hatfields", themePreference: "system", createdAt: "2026-01-01" };

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "u1",
    householdId: "h1",
    name: "Jeremy",
    avatarEmoji: "🙂",
    role: "member",
    isSystemAdmin: false,
    points: 30,
    createdAt: "2026-01-01",
    hasPin: false,
    ...overrides,
  };
}

describe("RewardsPage", () => {
  it("shows the empty state and hides management for a plain member", async () => {
    mockApi({
      "GET /api/auth/me": { body: { household, user: profile() } },
      "GET /api/rewards": { body: { rewards: [] } },
    });
    renderWithProviders(<RewardsPage />);
    await waitFor(() => expect(screen.getByText("No rewards in the store yet.")).toBeInTheDocument());
    expect(screen.queryByText("Manage rewards")).not.toBeInTheDocument();
  });

  it("shows active rewards sorted by cost, and management section for a hoh", async () => {
    mockApi({
      "GET /api/auth/me": { body: { household, user: profile({ role: "hoh" }) } },
      "GET /api/rewards": {
        body: {
          rewards: [
            { id: "rw1", title: "Big prize", pointCost: 50, isActive: true },
            { id: "rw2", title: "Small prize", pointCost: 10, isActive: false },
          ],
        },
      },
    });
    renderWithProviders(<RewardsPage />);
    await waitFor(() => expect(screen.getByText("Manage rewards")).toBeInTheDocument());
    expect(screen.getAllByText(/Big prize/).length).toBeGreaterThan(0);
    expect(screen.getByText("Add a reward")).toBeInTheDocument();
  });
});
