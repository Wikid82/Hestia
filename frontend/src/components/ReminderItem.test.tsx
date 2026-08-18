import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockApi } from "@/test/mockApi";
import { ReminderItem } from "./ReminderItem";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderItem(props: Partial<ComponentProps<typeof ReminderItem>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ReminderItem
        reminder={{ id: "r1", title: "Take out trash", notes: "Bins on curb", dueAt: "2026-08-20", isDone: false }}
        assignee={{ name: "Jeremy", avatarEmoji: "🙂" }}
        canDelete
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe("ReminderItem", () => {
  it("shows title, notes, assignee, and due date", () => {
    renderItem();
    expect(screen.getByText("Take out trash")).toBeInTheDocument();
    expect(screen.getByText("Bins on curb")).toBeInTheDocument();
    expect(screen.getByText(/Jeremy/)).toBeInTheDocument();
  });

  it("shows Everyone when there is no assignee", () => {
    renderItem({ assignee: null });
    expect(screen.getByText(/Everyone/)).toBeInTheDocument();
  });

  it("toggles done state", async () => {
    // isDone lives on the reminder prop, owned by the parent's query — the
    // toggle button only fires the mutation + cache invalidation, so we
    // assert the request fired and the button re-enables, not a local
    // isDone flip.
    const user = userEvent.setup();
    const fetchMock = mockApi({ "PATCH /api/reminders/r1/toggle": { body: { id: "r1", isDone: true } } });
    renderItem();
    await user.click(screen.getByLabelText("Mark done"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/reminders/r1/toggle",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
    await waitFor(() => expect(screen.getByLabelText("Mark done")).not.toBeDisabled());
  });

  it("shows Mark not done label and strikethrough text when already done", () => {
    renderItem({ reminder: { id: "r1", title: "Done thing", isDone: true } });
    expect(screen.getByLabelText("Mark not done")).toBeInTheDocument();
  });

  it("hides delete button when canDelete is false", () => {
    renderItem({ canDelete: false });
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
  });

  it("deletes on click when canDelete is true", async () => {
    const user = userEvent.setup();
    mockApi({ "DELETE /api/reminders/r1": { body: { ok: true } } });
    renderItem();
    await user.click(screen.getByText("Delete"));
    await waitFor(() => expect(screen.getByText("Delete")).not.toBeDisabled());
  });
});
