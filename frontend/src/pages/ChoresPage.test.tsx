import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { mockApi } from "@/test/mockApi";
import { renderWithProviders } from "@/test/render";
import ChoresPage from "./ChoresPage";
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
    points: 0,
    createdAt: "2026-01-01",
    hasPin: false,
    ...overrides,
  };
}

function apiHandlers(user: Profile) {
  return {
    "GET /api/auth/me": { body: { household, user } },
    "GET /api/members": { body: { members: [user] } },
    "GET /api/chores?due=today": { body: { chores: [{ id: "c1", title: "Dishes", points: 5, completedToday: false, assignedToUserId: "u1" }] } },
    "GET /api/chores": {
      body: {
        chores: [
          {
            id: "c1",
            title: "Dishes",
            points: 5,
            completedToday: false,
            assignedToUserId: "u1",
            dueDate: "2026-08-17",
            recurrence: "daily",
            recurrenceDays: null,
          },
          {
            id: "c2",
            title: "Vacuum",
            points: 3,
            completedToday: false,
            assignedToUserId: null,
            dueDate: "2026-08-17",
            recurrence: "weekly",
            recurrenceDays: null,
          },
        ],
      },
    },
  };
}

describe("ChoresPage", () => {
  it("shows today's chores and hides management section for a plain member", async () => {
    mockApi(apiHandlers(profile()));
    renderWithProviders(<ChoresPage />);
    await waitFor(() => expect(screen.getByText("Today")).toBeInTheDocument());
    expect(screen.getByText("Dishes")).toBeInTheDocument();
    expect(screen.queryByText("All chores")).not.toBeInTheDocument();
  });

  it("shows the management section and chore form for a hoh", async () => {
    mockApi(apiHandlers(profile({ role: "hoh" })));
    renderWithProviders(<ChoresPage />);
    await waitFor(() => expect(screen.getByText("All chores")).toBeInTheDocument());
    expect(screen.getByText("Add a chore")).toBeInTheDocument();
  });

  it("shows the empty state when nothing is due today", async () => {
    mockApi({
      "GET /api/auth/me": { body: { household, user: profile() } },
      "GET /api/members": { body: { members: [] } },
      "GET /api/chores?due=today": { body: { chores: [] } },
      "GET /api/chores": { body: { chores: [] } },
    });
    renderWithProviders(<ChoresPage />);
    await waitFor(() => expect(screen.getByText("No chores due today.")).toBeInTheDocument());
  });
});
