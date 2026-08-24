import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { mockApi } from "@/test/mockApi";
import { renderWithProviders } from "@/test/render";
import AppShell from "./AppShell";
import type { Household, Profile } from "@/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

const household: Household = {
  id: "h1",
  name: "Hatfields",
  themePreference: "system",
  createdAt: "2026-01-01",
};

function member(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "u1",
    householdId: "h1",
    name: "Jeremy",
    avatarEmoji: "🙂",
    role: "member",
    isSystemAdmin: false,
    points: 12,
    createdAt: "2026-01-01",
    hasPin: false,
    ...overrides,
  };
}

describe("AppShell", () => {
  it("shows household name, profile info, and hides admin-only links for a plain member", async () => {
    mockApi({ "GET /api/auth/me": { body: { household, user: member() } } });
    renderWithProviders(<AppShell />);
    await waitFor(() => expect(screen.getByText("Hatfields")).toBeInTheDocument());
    expect(screen.getByText("Jeremy")).toBeInTheDocument();
    expect(screen.getByText("· 12 pts")).toBeInTheDocument();
    expect(screen.queryByText("Household")).not.toBeInTheDocument();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });

  it("shows the Household link for a hoh and Admin link for a system admin", async () => {
    mockApi({
      "GET /api/auth/me": { body: { household, user: member({ role: "hoh", isSystemAdmin: true }) } },
    });
    renderWithProviders(<AppShell />);
    await waitFor(() => expect(screen.getByText("Household")).toBeInTheDocument());
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("logout and switch buttons call the corresponding auth actions", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/me": { body: { household, user: member() } },
      "POST /api/auth/logout": { body: { ok: true } },
      "POST /api/profiles/to-picker": { body: { ok: true } },
    });
    renderWithProviders(<AppShell />);
    await waitFor(() => expect(screen.getByText("Jeremy")).toBeInTheDocument());

    await user.click(screen.getByText("Switch"));
    await waitFor(() => expect(screen.queryByText("Jeremy")).not.toBeInTheDocument());
  });
});
