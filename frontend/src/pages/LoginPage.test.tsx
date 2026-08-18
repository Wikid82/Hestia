import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { mockApi } from "@/test/mockApi";
import { renderWithProviders } from "@/test/render";
import LoginPage from "./LoginPage";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LoginPage", () => {
  it("submits email/password and calls the login endpoint", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({
      "GET /api/auth/me": { status: 401, body: { error: "unauthorized" } },
      "POST /api/auth/login": { body: { user: { id: "u1" } } },
    });
    renderWithProviders(<LoginPage />);
    await waitFor(() => screen.getByLabelText("Email"));

    await user.type(screen.getByLabelText("Email"), "j@example.com");
    await user.type(screen.getByLabelText("Password"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ method: "POST" })),
    );
  });

  it("shows an error message when login fails", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/me": { status: 401, body: { error: "unauthorized" } },
      "POST /api/auth/login": { status: 401, body: { error: "Invalid credentials" } },
    });
    renderWithProviders(<LoginPage />);
    await waitFor(() => screen.getByLabelText("Email"));

    await user.type(screen.getByLabelText("Email"), "j@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Invalid credentials"));
  });

  it("links to the forgot-password page", async () => {
    mockApi({ "GET /api/auth/me": { status: 401, body: { error: "unauthorized" } } });
    renderWithProviders(<LoginPage />);
    await waitFor(() => screen.getByLabelText("Email"));

    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });
});
