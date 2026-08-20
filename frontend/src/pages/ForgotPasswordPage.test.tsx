import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { mockApi } from "@/test/mockApi";
import { renderWithProviders } from "@/test/render";
import ForgotPasswordPage from "./ForgotPasswordPage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ForgotPasswordPage", () => {
  it("submits the email and shows the generic success message", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({
      "GET /api/auth/me": { status: 401, body: { error: "unauthorized" } },
      "POST /api/auth/forgot-password": { body: { ok: true } },
    });
    renderWithProviders(<ForgotPasswordPage />);
    await waitFor(() => screen.getByLabelText("Email"));

    await user.type(screen.getByLabelText("Email"), "j@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/auth/forgot-password",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(screen.getByRole("status")).toHaveTextContent(/reset link is on its way/);
  });
});
