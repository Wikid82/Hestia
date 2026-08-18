import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { mockApi } from "@/test/mockApi";
import { renderWithProviders } from "@/test/render";
import HubPage from "./HubPage";
import type { Household, Profile } from "@/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

const household: Household = { id: "h1", name: "Hatfields", themePreference: "system", createdAt: "2026-01-01" };
const profile: Profile = {
  id: "u1",
  householdId: "h1",
  name: "Jeremy",
  avatarEmoji: "🙂",
  role: "hoh",
  isSystemAdmin: true,
  points: 15,
  createdAt: "2026-01-01",
  hasPin: false,
};

describe("HubPage", () => {
  it("shows empty states when there are no chores or reminders", async () => {
    mockApi({
      "GET /api/auth/me": { body: { household, user: profile } },
      "GET /api/chores?due=today": { body: { chores: [] } },
      "GET /api/reminders": { body: { reminders: [] } },
    });
    renderWithProviders(<HubPage />);
    await waitFor(() => expect(screen.getByText(/Hi, 🙂 Jeremy/)).toBeInTheDocument());
    expect(screen.getByText("Nothing assigned to you today.")).toBeInTheDocument();
    expect(screen.getByText("Nothing pending.")).toBeInTheDocument();
  });

  it("shows chores assigned to the current profile and filters reminders", async () => {
    mockApi({
      "GET /api/auth/me": { body: { household, user: profile } },
      "GET /api/chores?due=today": {
        body: {
          chores: [
            { id: "c1", title: "Dishes", points: 5, completedToday: false, assignedToUserId: "u1" },
            { id: "c2", title: "Laundry", points: 5, completedToday: false, assignedToUserId: "other" },
          ],
        },
      },
      "GET /api/reminders": {
        body: {
          reminders: [
            { id: "r1", title: "Take out trash", isDone: false, assignedToUserId: "u1" },
            { id: "r2", title: "Someone else's", isDone: false, assignedToUserId: "other" },
            { id: "r3", title: "Already done", isDone: true, assignedToUserId: "u1" },
          ],
        },
      },
    });
    renderWithProviders(<HubPage />);
    await waitFor(() => expect(screen.getByText("Dishes")).toBeInTheDocument());
    expect(screen.queryByText("Laundry")).not.toBeInTheDocument();
    expect(screen.getByText("Take out trash")).toBeInTheDocument();
    expect(screen.queryByText("Someone else's")).not.toBeInTheDocument();
    expect(screen.queryByText("Already done")).not.toBeInTheDocument();
  });
});
