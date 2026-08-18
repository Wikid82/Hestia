import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { mockApi } from "@/test/mockApi";
import { renderWithProviders } from "@/test/render";
import AccountPage from "./AccountPage";
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
    isSystemAdmin: true,
    points: 0,
    createdAt: "2026-01-01",
    hasPin: false,
    email: null,
    ...overrides,
  };
}

describe("AccountPage", () => {
  it("shows the set-up-login copy and no current password field when no login exists", async () => {
    mockApi({ "GET /api/auth/me": { body: { household, user: profile() } } });
    renderWithProviders(<AccountPage />);
    await waitFor(() => screen.getByText("Your account"));
    expect(screen.queryByText("Current password")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set up login" })).toBeInTheDocument();
  });

  it("shows the current-password field and Update login label when a login exists", async () => {
    mockApi({ "GET /api/auth/me": { body: { household, user: profile({ email: "j@example.com" }) } } });
    renderWithProviders(<AccountPage />);
    await waitFor(() => screen.getByText("Current password"));
    expect(screen.getByRole("button", { name: "Update login" })).toBeInTheDocument();
  });

  it("submits credentials and shows a success notice", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/me": { body: { household, user: profile() } },
      "PATCH /api/members/me/credentials": { body: profile({ email: "j@example.com" }) },
    });
    renderWithProviders(<AccountPage />);
    await waitFor(() => screen.getByText("Your account"));

    await user.type(screen.getByLabelText("Email"), "j@example.com");
    await user.type(screen.getByLabelText("Password", { exact: false }), "hunter22");
    await user.click(screen.getByRole("button", { name: "Set up login" }));

    await waitFor(() => expect(screen.getByText("Login updated.")).toBeInTheDocument());
  });

  it("shows an error message when the update fails", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/me": { body: { household, user: profile() } },
      "PATCH /api/members/me/credentials": { status: 400, body: { error: "Email taken" } },
    });
    renderWithProviders(<AccountPage />);
    await waitFor(() => screen.getByText("Your account"));

    await user.type(screen.getByLabelText("Email"), "j@example.com");
    await user.type(screen.getByLabelText("Password", { exact: false }), "hunter22");
    await user.click(screen.getByRole("button", { name: "Set up login" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Email taken"));
  });
});
