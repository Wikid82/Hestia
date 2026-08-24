import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { mockApi } from "@/test/mockApi";
import { renderWithProviders } from "@/test/render";
import { HouseholdName } from "./HouseholdName";
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

describe("HouseholdName", () => {
  it("renders the name and switches to edit mode", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/auth/me": { body: { household, user: profile } } });
    renderWithProviders(<HouseholdName name="Hatfields" />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Hatfields" })).toBeInTheDocument());

    await user.click(screen.getByText("Edit"));
    expect(screen.getByDisplayValue("Hatfields")).toBeInTheDocument();
  });

  it("cancel reverts to the original name without saving", async () => {
    const user = userEvent.setup();
    mockApi({ "GET /api/auth/me": { body: { household, user: profile } } });
    renderWithProviders(<HouseholdName name="Hatfields" />);
    await waitFor(() => screen.getByText("Edit"));
    await user.click(screen.getByText("Edit"));

    const input = screen.getByDisplayValue("Hatfields");
    await user.clear(input);
    await user.type(input, "Something else");
    await user.click(screen.getByText("Cancel"));

    expect(screen.getByRole("heading", { name: "Hatfields" })).toBeInTheDocument();
  });

  it("submits the new name and returns to view mode on success", async () => {
    // Component renders its `name` prop, not auth state, so on success it
    // just exits edit mode — the parent is responsible for re-passing the
    // updated name from wherever it sources household.name.
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/me": { body: { household, user: profile } },
      "PATCH /api/household": { body: { ...household, name: "Renamed" } },
    });
    renderWithProviders(<HouseholdName name="Hatfields" />);
    await waitFor(() => screen.getByText("Edit"));
    await user.click(screen.getByText("Edit"));

    const input = screen.getByDisplayValue("Hatfields");
    await user.clear(input);
    await user.type(input, "Renamed");
    await user.click(screen.getByText("Save"));

    await waitFor(() => expect(screen.queryByDisplayValue("Renamed")).not.toBeInTheDocument());
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });

  it("shows an error message when the rename fails", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/me": { body: { household, user: profile } },
      "PATCH /api/household": { status: 400, body: { error: "Name required" } },
    });
    renderWithProviders(<HouseholdName name="Hatfields" />);
    await waitFor(() => screen.getByText("Edit"));
    await user.click(screen.getByText("Edit"));
    await user.click(screen.getByText("Save"));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Name required"));
  });
});
