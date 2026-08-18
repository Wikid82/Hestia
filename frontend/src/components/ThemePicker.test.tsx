import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { mockApi } from "@/test/mockApi";
import { renderWithProviders } from "@/test/render";
import { ThemePicker } from "./ThemePicker";
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

describe("ThemePicker", () => {
  it("marks the current value's radio as checked", async () => {
    mockApi({ "GET /api/auth/me": { body: { household, user: profile } } });
    renderWithProviders(<ThemePicker value="dark" />);
    await waitFor(() => expect((screen.getByDisplayValue("dark") as HTMLInputElement).checked).toBe(true));
    expect((screen.getByDisplayValue("light") as HTMLInputElement).checked).toBe(false);
  });

  it("selecting a new option submits it", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({
      "GET /api/auth/me": { body: { household, user: profile } },
      "PATCH /api/household": { body: { ...household, themePreference: "dark" } },
    });
    renderWithProviders(<ThemePicker value="system" />);
    await waitFor(() => screen.getByDisplayValue("dark"));

    await user.click(screen.getByDisplayValue("dark"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/household",
        expect.objectContaining({ method: "PATCH", body: JSON.stringify({ themePreference: "dark" }) }),
      ),
    );
  });

  it("shows an error when the update fails", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/me": { body: { household, user: profile } },
      "PATCH /api/household": { status: 500, body: { error: "boom" } },
    });
    renderWithProviders(<ThemePicker value="system" />);
    await waitFor(() => screen.getByDisplayValue("dark"));
    await user.click(screen.getByDisplayValue("dark"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("boom"));
  });
});
