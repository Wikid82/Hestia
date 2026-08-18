import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { mockApi } from "@/test/mockApi";
import { renderWithProviders } from "@/test/render";
import HouseholdPage from "./HouseholdPage";
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

describe("HouseholdPage", () => {
  it("redirects a non-hoh member away", async () => {
    mockApi({ "GET /api/auth/me": { body: { household, user: profile() } } });
    renderWithProviders(<HouseholdPage />);
    await waitFor(() => expect(screen.queryByText("Manage who's here.")).not.toBeInTheDocument());
  });

  it("renders members, appearance, add-member, and invite sections for a hoh", async () => {
    mockApi({
      "GET /api/auth/me": { body: { household, user: profile({ role: "hoh" }) } },
      "GET /api/members": { body: { members: [profile({ role: "hoh" })] } },
      "GET /api/members/invites": { body: { invites: [] } },
    });
    renderWithProviders(<HouseholdPage />);
    await waitFor(() => expect(screen.getByText("Manage who's here.")).toBeInTheDocument());
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("Add a family member")).toBeInTheDocument();
    expect(screen.getByText("Invite a member by email")).toBeInTheDocument();
    expect(screen.getByText("Jeremy")).toBeInTheDocument();
  });

  it("submits a member invite and shows the sent notice", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/me": { body: { household, user: profile({ role: "hoh" }) } },
      "GET /api/members": { body: { members: [] } },
      "GET /api/members/invites": { body: { invites: [] } },
      "POST /api/members/invites": { body: { invite: { id: "i1" }, emailSent: true } },
    });
    renderWithProviders(<HouseholdPage />);
    await waitFor(() => screen.getByPlaceholderText("email@example.com"));

    await user.type(screen.getByPlaceholderText("email@example.com"), "friend@example.com");
    await user.click(screen.getByRole("button", { name: "Invite" }));

    await waitFor(() => expect(screen.getByText("Invite sent.")).toBeInTheDocument());
  });

  it("shows the email-failed notice when invite email delivery fails", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/me": { body: { household, user: profile({ role: "hoh" }) } },
      "GET /api/members": { body: { members: [] } },
      "GET /api/members/invites": { body: { invites: [] } },
      "POST /api/members/invites": { body: { invite: { id: "i1" }, emailSent: false, emailError: "smtp down" } },
    });
    renderWithProviders(<HouseholdPage />);
    await waitFor(() => screen.getByPlaceholderText("email@example.com"));

    await user.type(screen.getByPlaceholderText("email@example.com"), "friend@example.com");
    await user.click(screen.getByRole("button", { name: "Invite" }));

    await waitFor(() => expect(screen.getByText(/email failed to send: smtp down/)).toBeInTheDocument());
  });

  it("revokes a pending invite", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({
      "GET /api/auth/me": { body: { household, user: profile({ role: "hoh" }) } },
      "GET /api/members": { body: { members: [] } },
      "GET /api/members/invites": {
        body: { invites: [{ id: "i1", role: "member", email: "friend@example.com", status: "pending", invitedByUserId: "u1", expiresAt: "2026-09-01", createdAt: "2026-08-01" }] },
      },
      "DELETE /api/members/invites/i1": { body: { ok: true } },
    });
    renderWithProviders(<HouseholdPage />);
    await waitFor(() => screen.getByText("friend@example.com"));

    await user.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/members/invites/i1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });
});
