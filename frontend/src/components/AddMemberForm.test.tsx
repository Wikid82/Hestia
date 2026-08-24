import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockApi } from "@/test/mockApi";
import { AddMemberForm } from "./AddMemberForm";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AddMemberForm />
    </QueryClientProvider>,
  );
}

describe("AddMemberForm", () => {
  it("submits name, avatar, role, and pin, then resets", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ "POST /api/members": { body: { id: "m1", name: "Kid" } } });
    renderForm();

    await user.type(screen.getByPlaceholderText("Name"), "Kid");
    await user.selectOptions(screen.getByDisplayValue("Kid / member"), "hoh");
    await user.type(screen.getByPlaceholderText("PIN (optional)"), "1234");
    await user.click(screen.getByRole("button", { name: "Add member" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/members",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "Kid", avatarEmoji: "🙂", role: "hoh", pin: "1234" }),
        }),
      ),
    );
    await waitFor(() => expect(screen.getByPlaceholderText("Name")).toHaveValue(""));
  });

  it("shows an error message on failure", async () => {
    const user = userEvent.setup();
    mockApi({ "POST /api/members": { status: 400, body: { error: "Name required" } } });
    renderForm();

    await user.type(screen.getByPlaceholderText("Name"), "x");
    await user.click(screen.getByRole("button", { name: "Add member" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Name required"));
  });
});
