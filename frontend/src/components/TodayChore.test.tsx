import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockApi } from "@/test/mockApi";
import { TodayChore } from "./TodayChore";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderChore(props: Partial<ComponentProps<typeof TodayChore>> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <TodayChore
        chore={{ id: "c1", title: "Dishes", points: 5, completedToday: false }}
        assignee={{ name: "Jeremy", avatarEmoji: "🙂" }}
        canAct
        {...props}
      />
    </QueryClientProvider>,
  );
}

describe("TodayChore", () => {
  it("shows Unassigned when there is no assignee", () => {
    renderChore({ assignee: null });
    expect(screen.getByText(/Unassigned/)).toBeInTheDocument();
  });

  it("shows Done button and completes the chore", async () => {
    const user = userEvent.setup();
    mockApi({ "POST /api/chores/c1/complete": { body: { ok: true, alreadyDone: false } } });
    renderChore();
    await user.click(screen.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Done" })).not.toBeDisabled());
  });

  it("shows Undo button when already completed and uncompletes on click", async () => {
    const user = userEvent.setup();
    mockApi({ "POST /api/chores/c1/uncomplete": { body: { ok: true } } });
    renderChore({ chore: { id: "c1", title: "Dishes", points: 5, completedToday: true } });
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Undo" })).not.toBeDisabled());
  });

  it("hides action buttons when canAct is false", () => {
    renderChore({ canAct: false });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
