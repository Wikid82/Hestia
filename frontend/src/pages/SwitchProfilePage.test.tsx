import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { mockApi } from "@/test/mockApi";
import { renderWithProviders } from "@/test/render";
import SwitchProfilePage from "./SwitchProfilePage";
import type { Household } from "@/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

const household: Household = { id: "h1", name: "Hatfields", themePreference: "system", createdAt: "2026-01-01" };

describe("SwitchProfilePage", () => {
  it("shows the avatar picker with household name", async () => {
    mockApi({
      "GET /api/auth/me": { body: { household, user: null } },
      "GET /api/profiles": {
        body: {
          profiles: [
            { id: "u1", householdId: "h1", name: "Jeremy", avatarEmoji: "🙂", role: "hoh", isSystemAdmin: true, points: 0, createdAt: "2026-01-01", hasPin: false },
            { id: "u2", householdId: "h1", name: "Kid", avatarEmoji: "🦊", role: "member", isSystemAdmin: false, points: 0, createdAt: "2026-01-01", hasPin: true },
          ],
        },
      },
    });
    renderWithProviders(<SwitchProfilePage />);
    await waitFor(() => expect(screen.getByText("Hatfields")).toBeInTheDocument());
    expect(screen.getByText("Jeremy")).toBeInTheDocument();
    expect(screen.getByText("Kid")).toBeInTheDocument();
  });

  it("selects a no-pin profile and switches directly on submit", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({
      "GET /api/auth/me": { body: { household, user: null } },
      "GET /api/profiles": {
        body: {
          profiles: [
            { id: "u1", householdId: "h1", name: "Jeremy", avatarEmoji: "🙂", role: "hoh", isSystemAdmin: true, points: 0, createdAt: "2026-01-01", hasPin: false },
          ],
        },
      },
      "POST /api/profiles/u1/switch": { body: { user: { id: "u1", name: "Jeremy" } } },
    });
    renderWithProviders(<SwitchProfilePage />);
    await waitFor(() => screen.getByText("Jeremy"));
    await user.click(screen.getByText("Jeremy"));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/profiles/u1/switch",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("requires a pin field for a pin-gated profile and shows errors", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/me": { body: { household, user: null } },
      "GET /api/profiles": {
        body: {
          profiles: [
            { id: "u2", householdId: "h1", name: "Kid", avatarEmoji: "🦊", role: "member", isSystemAdmin: false, points: 0, createdAt: "2026-01-01", hasPin: true },
          ],
        },
      },
      "POST /api/profiles/u2/switch": { status: 401, body: { error: "Wrong PIN" } },
    });
    renderWithProviders(<SwitchProfilePage />);
    await waitFor(() => screen.getByText("Kid"));
    await user.click(screen.getByText("Kid"));
    expect(screen.getByPlaceholderText("PIN")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("PIN"), "0000");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Wrong PIN"));
  });

  it("Back returns to the picker", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/me": { body: { household, user: null } },
      "GET /api/profiles": {
        body: {
          profiles: [
            { id: "u1", householdId: "h1", name: "Jeremy", avatarEmoji: "🙂", role: "hoh", isSystemAdmin: true, points: 0, createdAt: "2026-01-01", hasPin: false },
          ],
        },
      },
    });
    renderWithProviders(<SwitchProfilePage />);
    await waitFor(() => screen.getByText("Jeremy"));
    await user.click(screen.getByText("Jeremy"));
    await user.click(screen.getByText("Back"));
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  });
});
