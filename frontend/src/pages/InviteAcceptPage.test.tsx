import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { mockApi } from "@/test/mockApi";
import { AuthProvider } from "@/context/AuthContext";
import InviteAcceptPage from "./InviteAcceptPage";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <Routes>
            <Route path="/invite/:token" element={<InviteAcceptPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("InviteAcceptPage", () => {
  it("shows an invalid-link message for a bogus token", async () => {
    mockApi({
      "GET /api/auth/me": { status: 401, body: { error: "unauthorized" } },
      "GET /api/invites/bogus-token": { status: 404, body: { error: "not found" } },
    });
    renderAt("/invite/bogus-token");
    await waitFor(() => expect(screen.getByText("This invite link isn't valid.")).toBeInTheDocument());
  });

  it("shows a status message for a non-pending invite", async () => {
    mockApi({
      "GET /api/auth/me": { status: 401, body: { error: "unauthorized" } },
      "GET /api/invites/tok1": {
        body: { role: "member", email: "a@example.com", status: "revoked", expiresAt: "2026-09-01" },
      },
    });
    renderAt("/invite/tok1");
    await waitFor(() => expect(screen.getByText("This invite has been revoked.")).toBeInTheDocument());
  });

  it("shows the accept form and household-name field for a pending hoh invite", async () => {
    mockApi({
      "GET /api/auth/me": { status: 401, body: { error: "unauthorized" } },
      "GET /api/invites/tok2": {
        body: { role: "hoh", email: "a@example.com", status: "pending", expiresAt: "2026-09-01" },
      },
    });
    renderAt("/invite/tok2");
    await waitFor(() => expect(screen.getByLabelText("Household name")).toBeInTheDocument());
  });

  it("shows the household name in copy for a pending member invite, without the household-name field", async () => {
    mockApi({
      "GET /api/auth/me": { status: 401, body: { error: "unauthorized" } },
      "GET /api/invites/tok3": {
        body: {
          role: "member",
          email: "a@example.com",
          status: "pending",
          householdName: "Hatfields",
          expiresAt: "2026-09-01",
        },
      },
    });
    renderAt("/invite/tok3");
    await waitFor(() => expect(screen.getByText(/Hatfields/)).toBeInTheDocument());
    expect(screen.queryByLabelText("Household name")).not.toBeInTheDocument();
  });

  it("submits the accept form and shows an error on failure", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/me": { status: 401, body: { error: "unauthorized" } },
      "GET /api/invites/tok4": {
        body: { role: "member", email: "a@example.com", status: "pending", householdName: "Hatfields", expiresAt: "2026-09-01" },
      },
      "POST /api/invites/tok4/accept": { status: 400, body: { error: "Password too short" } },
    });
    renderAt("/invite/tok4");
    await waitFor(() => screen.getByLabelText("Your name"));

    await user.type(screen.getByLabelText("Your name"), "New Person");
    await user.type(screen.getByLabelText("Password"), "short");
    await user.click(screen.getByRole("button", { name: "Accept invite" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Password too short"));
  });
});
