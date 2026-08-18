import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { mockApi } from "@/test/mockApi";
import { renderWithProviders } from "@/test/render";
import AdminSettingsPage from "./AdminSettingsPage";
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
    role: "hoh",
    isSystemAdmin: false,
    points: 0,
    createdAt: "2026-01-01",
    hasPin: false,
    ...overrides,
  };
}

function baseHandlers(user: Profile) {
  return {
    "GET /api/auth/me": { body: { household, user } },
    "GET /api/admin/notification-settings": { body: { id: "n1", provider: "", config: {}, updatedAt: "2026-08-01" } },
    "GET /api/admin/invites": { body: { invites: [] } },
  };
}

describe("AdminSettingsPage", () => {
  it("redirects a non-system-admin away", async () => {
    mockApi(baseHandlers(profile()));
    renderWithProviders(<AdminSettingsPage />);
    await waitFor(() => expect(screen.queryByText("Admin settings")).not.toBeInTheDocument());
  });

  it("renders the invite and notification sections for a system admin", async () => {
    mockApi(baseHandlers(profile({ isSystemAdmin: true })));
    renderWithProviders(<AdminSettingsPage />);
    await waitFor(() => expect(screen.getByText("Admin settings")).toBeInTheDocument());
    expect(screen.getByText("Invite a Head of Household")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send test notification" })).toBeDisabled();
  });

  it("shows provider-specific fields when a channel is selected", async () => {
    const user = userEvent.setup();
    mockApi(baseHandlers(profile({ isSystemAdmin: true })));
    renderWithProviders(<AdminSettingsPage />);
    await waitFor(() => screen.getByText("Channel"));

    await user.selectOptions(screen.getByLabelText("Channel"), "discord");
    expect(screen.getByText("Webhook URL")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Channel"), "pushover");
    expect(screen.getByText("User/group key")).toBeInTheDocument();
    expect(screen.getByText("Application API token")).toBeInTheDocument();
  });

  it("saves notification settings", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({
      ...baseHandlers(profile({ isSystemAdmin: true })),
      "PUT /api/admin/notification-settings": {
        body: { id: "n1", provider: "webhook", config: { url: "https://example.com" }, updatedAt: "2026-08-17" },
      },
    });
    renderWithProviders(<AdminSettingsPage />);
    await waitFor(() => screen.getByText("Channel"));

    await user.selectOptions(screen.getByLabelText("Channel"), "webhook");
    await user.type(screen.getByLabelText("Destination URL"), "https://example.com");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/notification-settings",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
  });

  it("shows an error message when saving fails", async () => {
    const user = userEvent.setup();
    mockApi({
      ...baseHandlers(profile({ isSystemAdmin: true })),
      "PUT /api/admin/notification-settings": { status: 400, body: { error: "Invalid URL" } },
    });
    renderWithProviders(<AdminSettingsPage />);
    await waitFor(() => screen.getByText("Channel"));

    await user.selectOptions(screen.getByLabelText("Channel"), "webhook");
    await user.type(screen.getByLabelText("Destination URL"), "not-a-url");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Invalid URL"));
  });

  it("sends a test notification once a provider is already configured", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/me": { body: { household, user: profile({ isSystemAdmin: true }) } },
      "GET /api/admin/notification-settings": {
        body: { id: "n1", provider: "webhook", config: { url: "https://example.com" }, updatedAt: "2026-08-01" },
      },
      "GET /api/admin/invites": { body: { invites: [] } },
      "POST /api/admin/notification-settings/test": { body: { ok: true } },
    });
    renderWithProviders(<AdminSettingsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Send test notification" })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: "Send test notification" }));
    await waitFor(() => expect(screen.getByText("Test notification sent.")).toBeInTheDocument());
  });

  it("shows a failure message when the test notification fails", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/me": { body: { household, user: profile({ isSystemAdmin: true }) } },
      "GET /api/admin/notification-settings": {
        body: { id: "n1", provider: "webhook", config: { url: "https://example.com" }, updatedAt: "2026-08-01" },
      },
      "GET /api/admin/invites": { body: { invites: [] } },
      "POST /api/admin/notification-settings/test": { status: 502, body: { error: "Delivery failed" } },
    });
    renderWithProviders(<AdminSettingsPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Send test notification" })).not.toBeDisabled());

    await user.click(screen.getByRole("button", { name: "Send test notification" }));
    await waitFor(() => expect(screen.getByText("Delivery failed")).toBeInTheDocument());
  });

  it("submits a HoH invite and shows the sent notice", async () => {
    const user = userEvent.setup();
    mockApi({
      ...baseHandlers(profile({ isSystemAdmin: true })),
      "POST /api/admin/invites": { body: { invite: { id: "i1" }, emailSent: true } },
    });
    renderWithProviders(<AdminSettingsPage />);
    await waitFor(() => screen.getByPlaceholderText("email@example.com"));

    await user.type(screen.getByPlaceholderText("email@example.com"), "newadmin@example.com");
    await user.click(screen.getByRole("button", { name: "Invite" }));

    await waitFor(() => expect(screen.getByText("Invite sent.")).toBeInTheDocument());
  });

  it("revokes a pending HoH invite", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({
      "GET /api/auth/me": { body: { household, user: profile({ isSystemAdmin: true }) } },
      "GET /api/admin/notification-settings": { body: { id: "n1", provider: "", config: {}, updatedAt: "2026-08-01" } },
      "GET /api/admin/invites": {
        body: { invites: [{ id: "i1", role: "hoh", email: "a@example.com", status: "pending", invitedByUserId: "u1", expiresAt: "2026-09-01", createdAt: "2026-08-01" }] },
      },
      "DELETE /api/admin/invites/i1": { body: { ok: true } },
    });
    renderWithProviders(<AdminSettingsPage />);
    await waitFor(() => screen.getByText("a@example.com"));

    await user.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/invites/i1",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });
});
