import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { mockApi } from "@/test/mockApi";
import { renderWithProviders } from "@/test/render";
import { useAuth } from "./AuthContext";
import type { Household, Profile } from "@/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

const household: Household = {
  id: "h1",
  name: "Hatfields",
  themePreference: "system",
  createdAt: "2026-01-01T00:00:00Z",
};

const profile: Profile = {
  id: "u1",
  householdId: "h1",
  name: "Jeremy",
  avatarEmoji: "🙂",
  role: "hoh",
  isSystemAdmin: true,
  points: 0,
  createdAt: "2026-01-01T00:00:00Z",
  hasPin: false,
};

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="status">{auth.status}</div>
      <div data-testid="household">{auth.household?.name ?? ""}</div>
      <div data-testid="profile">{auth.profile?.name ?? ""}</div>
      <button onClick={() => auth.login({ email: "j@example.com", password: "hunter2" })}>
        login
      </button>
      <button onClick={() => auth.logout()}>logout</button>
      <button onClick={() => auth.switchProfile("u1")}>switch</button>
      <button onClick={() => auth.switchToPicker()}>to-picker</button>
      <button onClick={() => auth.setHousehold({ ...household, name: "Renamed" })}>
        set-household
      </button>
      <button onClick={() => auth.setProfile({ ...profile, name: "Renamed" })}>
        set-profile
      </button>
    </div>
  );
}

describe("AuthContext", () => {
  it("starts loading, then unauthenticated when /auth/me 401s", async () => {
    mockApi({ "GET /api/auth/me": { status: 401, body: { error: "unauthorized" } } });
    renderWithProviders(<Probe />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
  });

  it("resolves to need-profile when household session exists but no user picked", async () => {
    mockApi({ "GET /api/auth/me": { body: { household, user: null } } });
    renderWithProviders(<Probe />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("need-profile"));
    expect(screen.getByTestId("household")).toHaveTextContent("Hatfields");
  });

  it("resolves to authed when a profile is already selected", async () => {
    mockApi({ "GET /api/auth/me": { body: { household, user: profile } } });
    renderWithProviders(<Probe />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authed"));
    expect(screen.getByTestId("profile")).toHaveTextContent("Jeremy");
  });

  it("login re-fetches session and becomes authed", async () => {
    let meCalls = 0;
    mockApi({
      "GET /api/auth/me": () => {
        meCalls += 1;
        return meCalls === 1
          ? { status: 401, body: { error: "unauthorized" } }
          : { body: { household, user: profile } };
      },
      "POST /api/auth/login": { body: { user: profile } },
    });
    renderWithProviders(<Probe />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));

    await act(async () => {
      screen.getByText("login").click();
    });
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authed"));
  });

  it("logout clears session state", async () => {
    mockApi({
      "GET /api/auth/me": { body: { household, user: profile } },
      "POST /api/auth/logout": { body: { ok: true } },
    });
    renderWithProviders(<Probe />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authed"));

    await act(async () => {
      screen.getByText("logout").click();
    });
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
    expect(screen.getByTestId("household")).toHaveTextContent("");
  });

  it("switchProfile updates profile while keeping household", async () => {
    mockApi({
      "GET /api/auth/me": { body: { household, user: null } },
      "POST /api/profiles/u1/switch": { body: { user: profile } },
    });
    renderWithProviders(<Probe />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("need-profile"));

    await act(async () => {
      screen.getByText("switch").click();
    });
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authed"));
    expect(screen.getByTestId("profile")).toHaveTextContent("Jeremy");
    expect(screen.getByTestId("household")).toHaveTextContent("Hatfields");
  });

  it("switchToPicker clears profile but keeps household and goes need-profile", async () => {
    mockApi({
      "GET /api/auth/me": { body: { household, user: profile } },
      "POST /api/profiles/to-picker": { body: { ok: true } },
    });
    renderWithProviders(<Probe />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authed"));

    await act(async () => {
      screen.getByText("to-picker").click();
    });
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("need-profile"));
    expect(screen.getByTestId("household")).toHaveTextContent("Hatfields");
    expect(screen.getByTestId("profile")).toHaveTextContent("");
  });

  it("setHousehold and setProfile update state directly", async () => {
    mockApi({ "GET /api/auth/me": { body: { household, user: profile } } });
    renderWithProviders(<Probe />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authed"));

    await act(async () => {
      screen.getByText("set-household").click();
    });
    expect(screen.getByTestId("household")).toHaveTextContent("Renamed");

    await act(async () => {
      screen.getByText("set-profile").click();
    });
    expect(screen.getByTestId("profile")).toHaveTextContent("Renamed");
  });

  it("throws when useAuth is used outside AuthProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    function Bare() {
      useAuth();
      return null;
    }
    // Rendered without AuthProvider, unlike renderWithProviders, to exercise
    // the outside-provider guard clause in useAuth().
    expect(() => render(<Bare />)).toThrow("useAuth must be used within AuthProvider");
    consoleError.mockRestore();
  });
});
