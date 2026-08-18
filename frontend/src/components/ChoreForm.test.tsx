import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockApi } from "@/test/mockApi";
import { ChoreForm } from "./ChoreForm";
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

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ChoreForm members={members} />
    </QueryClientProvider>,
  );
}

describe("ChoreForm", () => {
  it("submits a new chore and resets the form", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ "POST /api/chores": { body: { id: "c1", title: "Dishes" } } });
    renderForm();

    await user.type(screen.getByPlaceholderText("Title"), "Dishes");
    await user.selectOptions(screen.getByText("Assign to...").closest("select")!, "u1");
    const pointsInput = screen.getByPlaceholderText("Points");
    await user.clear(pointsInput);
    await user.type(pointsInput, "5");
    const dueDateInput = document.querySelector('input[name="dueDate"]') as HTMLInputElement;
    await user.clear(dueDateInput);
    await user.type(dueDateInput, "2026-08-20");
    await user.click(screen.getByRole("button", { name: "Add chore" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/chores", expect.objectContaining({ method: "POST" })),
    );
    await waitFor(() => expect(screen.getByPlaceholderText("Title")).toHaveValue(""));
  });

  it("shows an error message on failure", async () => {
    const user = userEvent.setup();
    mockApi({ "POST /api/chores": { status: 400, body: { error: "Title required" } } });
    renderForm();

    await user.type(screen.getByPlaceholderText("Title"), "x");
    await user.selectOptions(screen.getByText("Assign to...").closest("select")!, "u1");
    await user.click(screen.getByRole("button", { name: "Add chore" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Title required"));
  });
});
