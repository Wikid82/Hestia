import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockApi } from "@/test/mockApi";
import { ChoreRow } from "./ChoreRow";
import type { Chore, Profile } from "@/types";

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

const chore: Chore = {
  id: "c1",
  householdId: "h1",
  title: "Dishes",
  description: null,
  points: 5,
  dueDate: "2026-08-17",
  recurrence: "daily",
  recurrenceDays: null,
  assignedToUserId: "u1",
  isActive: true,
  createdAt: "2026-08-01",
  completedToday: false,
};

function renderRow() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ChoreRow chore={chore} members={members} />
    </QueryClientProvider>,
  );
}

describe("ChoreRow", () => {
  it("shows assignee, points, and recurrence description in view mode", () => {
    renderRow();
    expect(screen.getByText("Dishes")).toBeInTheDocument();
    expect(screen.getByText(/🦊 Kid/)).toBeInTheDocument();
    expect(screen.getByText(/Daily/)).toBeInTheDocument();
  });

  it("enters edit mode, cancels back to view mode", async () => {
    const user = userEvent.setup();
    renderRow();
    await user.click(screen.getByText("Edit"));
    expect(screen.getByDisplayValue("Dishes")).toBeInTheDocument();

    await user.click(screen.getByText("Cancel"));
    expect(screen.queryByDisplayValue("Dishes")).not.toBeInTheDocument();
    expect(screen.getByText("Dishes")).toBeInTheDocument();
  });

  it("saves an edit and returns to view mode", async () => {
    const user = userEvent.setup();
    mockApi({ "PATCH /api/chores/c1": { body: { ...chore, title: "Mop" } } });
    renderRow();
    await user.click(screen.getByText("Edit"));

    const titleInput = screen.getByDisplayValue("Dishes");
    await user.clear(titleInput);
    await user.type(titleInput, "Mop");
    await user.click(screen.getByText("Save"));

    await waitFor(() => expect(screen.queryByDisplayValue("Mop")).not.toBeInTheDocument());
  });

  it("shows an error when save fails", async () => {
    const user = userEvent.setup();
    mockApi({ "PATCH /api/chores/c1": { status: 400, body: { error: "Title required" } } });
    renderRow();
    await user.click(screen.getByText("Edit"));
    await user.click(screen.getByText("Save"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Title required"));
  });

  it("deletes on click", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ "DELETE /api/chores/c1": { body: { ok: true } } });
    renderRow();
    await user.click(screen.getByText("Delete"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/chores/c1", expect.objectContaining({ method: "DELETE" })),
    );
  });

  it("shows Unassigned when no member matches assignedToUserId", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ChoreRow chore={{ ...chore, assignedToUserId: "missing" }} members={members} />
      </QueryClientProvider>,
    );
    expect(screen.getByText(/Unassigned/)).toBeInTheDocument();
  });
});
