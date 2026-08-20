import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { mockApi } from "@/test/mockApi";
import { AuthProvider } from "@/context/AuthContext";
import ResetPasswordPage from "./ResetPasswordPage";

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
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="/login" element={<div>Login page</div>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ResetPasswordPage", () => {
  it("submits the new password and shows the success state", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/me": { status: 401, body: { error: "unauthorized" } },
      "POST /api/auth/reset-password": { body: { ok: true } },
    });
    renderAt("/reset-password/tok1");
    await waitFor(() => screen.getByLabelText("New password"));

    await user.type(screen.getByLabelText("New password"), "brand-new-password");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    await waitFor(() => expect(screen.getByText("Password reset")).toBeInTheDocument());
  });

  it("shows an error message when the token is invalid or expired", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/me": { status: 401, body: { error: "unauthorized" } },
      "POST /api/auth/reset-password": {
        status: 400,
        body: { error: "this password reset link is invalid or has expired" },
      },
    });
    renderAt("/reset-password/bad-token");
    await waitFor(() => screen.getByLabelText("New password"));

    await user.type(screen.getByLabelText("New password"), "brand-new-password");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("this password reset link is invalid or has expired"),
    );
  });
});
