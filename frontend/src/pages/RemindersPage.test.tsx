import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { mockApi } from "@/test/mockApi";
import { renderWithProviders } from "@/test/render";
import RemindersPage from "./RemindersPage";
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
  points: 0,
  createdAt: "2026-01-01",
  hasPin: false,
};

describe("RemindersPage", () => {
  it("shows empty state, then pending and done sections when reminders exist", async () => {
    mockApi({
      "GET /api/auth/me": { body: { household, user: profile } },
      "GET /api/members": { body: { members: [] } },
      "GET /api/reminders": {
        body: {
          reminders: [
            { id: "r1", title: "Pending one", isDone: false, assignedToUserId: null },
            { id: "r2", title: "Done one", isDone: true, assignedToUserId: null },
          ],
        },
      },
    });
    renderWithProviders(<RemindersPage />);
    await waitFor(() => expect(screen.getByText("Pending one")).toBeInTheDocument());
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Done one")).toBeInTheDocument();
  });

  it("shows the empty-pending message when there are no pending reminders", async () => {
    mockApi({
      "GET /api/auth/me": { body: { household, user: profile } },
      "GET /api/members": { body: { members: [] } },
      "GET /api/reminders": { body: { reminders: [] } },
    });
    renderWithProviders(<RemindersPage />);
    await waitFor(() => expect(screen.getByText("Nothing pending.")).toBeInTheDocument());
  });
});
