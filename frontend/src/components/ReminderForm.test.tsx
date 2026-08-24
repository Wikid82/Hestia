import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockApi } from "@/test/mockApi";
import { ReminderForm } from "./ReminderForm";
import type { Profile } from "@/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

const members: Profile[] = [
  {
    id: "u1",
    householdId: "h1",
    name: "Kid",
    avatarEmoji: "🦊",
    role: "member",
    isSystemAdmin: false,
    points: 0,
    createdAt: "2026-01-01",
    hasPin: false,
  },
];

function renderForm(isAdmin: boolean) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ReminderForm members={members} isAdmin={isAdmin} />
    </QueryClientProvider>,
  );
}

describe("ReminderForm", () => {
  it("hides the assignee select for non-admins", () => {
    renderForm(false);
    expect(screen.queryByText("Everyone")).not.toBeInTheDocument();
  });

  it("shows the assignee select for admins", () => {
    renderForm(true);
    expect(screen.getByText("Everyone")).toBeInTheDocument();
    expect(screen.getByText("🦊 Kid")).toBeInTheDocument();
  });

  it("submits and resets the form on success", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ "POST /api/reminders": { body: { id: "rem1", title: "Water plants" } } });
    renderForm(true);

    await user.type(screen.getByPlaceholderText("Title"), "Water plants");
    await user.type(screen.getByPlaceholderText("Notes (optional)"), "Ferns need extra");
    await user.selectOptions(screen.getByText("Everyone").closest("select")!, "u1");
    await user.click(screen.getByRole("button", { name: "Add reminder" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/reminders",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(screen.getByPlaceholderText("Title")).toHaveValue(""));
  });

  it("shows an error message on failure", async () => {
    const user = userEvent.setup();
    mockApi({ "POST /api/reminders": { status: 400, body: { error: "Title required" } } });
    renderForm(false);

    await user.type(screen.getByPlaceholderText("Title"), "x");
    await user.click(screen.getByRole("button", { name: "Add reminder" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Title required"));
  });
});
