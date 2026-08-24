import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { mockApi } from "@/test/mockApi";
import { renderWithProviders } from "@/test/render";
import SignupPage from "./SignupPage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignupPage", () => {
  it("submits household name, name, email and password", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({
      "GET /api/auth/me": { status: 401, body: { error: "unauthorized" } },
      "POST /api/auth/signup": { body: { household: { id: "h1" }, user: { id: "u1" } } },
    });
    renderWithProviders(<SignupPage />);
    await waitFor(() => screen.getByLabelText("Household name"));

    await user.type(screen.getByLabelText("Household name"), "Hatfields");
    await user.type(screen.getByLabelText("Your name"), "Jeremy");
    await user.type(screen.getByLabelText("Email"), "j@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter22");
    await user.click(screen.getByRole("button", { name: "Create household" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/signup", expect.objectContaining({ method: "POST" })),
    );
  });

  it("shows an error message on failure", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/me": { status: 401, body: { error: "unauthorized" } },
      "POST /api/auth/signup": { status: 400, body: { error: "Email already in use" } },
    });
    renderWithProviders(<SignupPage />);
    await waitFor(() => screen.getByLabelText("Household name"));

    await user.type(screen.getByLabelText("Household name"), "Hatfields");
    await user.type(screen.getByLabelText("Your name"), "Jeremy");
    await user.type(screen.getByLabelText("Email"), "j@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter22");
    await user.click(screen.getByRole("button", { name: "Create household" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Email already in use"));
  });
});
