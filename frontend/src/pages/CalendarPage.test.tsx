import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { mockApi } from "@/test/mockApi";
import CalendarPage from "./CalendarPage";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderPage(initialPath = "/calendar") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <CalendarPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CalendarPage", () => {
  it("renders the current month with chores and reminders placed on the right day", async () => {
    mockApi({
      "GET /api/chores": {
        body: {
          chores: [
            { id: "c1", title: "Water plants", points: 1, dueDate: "2026-08-05", recurrence: "none", recurrenceDays: null },
          ],
        },
      },
      "GET /api/reminders": {
        body: { reminders: [{ id: "r1", title: "Pay rent", dueAt: "2026-08-05" }] },
      },
    });
    renderPage("/calendar?month=2026-8");
    await waitFor(() => expect(screen.getByText("August 2026")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Water plants")).toBeInTheDocument());
    expect(screen.getByText("Pay rent")).toBeInTheDocument();
  });

  it("navigates to the next and previous month", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/chores": { body: { chores: [] } },
      "GET /api/reminders": { body: { reminders: [] } },
    });
    renderPage("/calendar?month=2026-8");
    await waitFor(() => screen.getByText("August 2026"));

    await user.click(screen.getByText("Next →"));
    await waitFor(() => expect(screen.getByText("September 2026")).toBeInTheDocument());

    await user.click(screen.getByText("← Prev"));
    await waitFor(() => expect(screen.getByText("August 2026")).toBeInTheDocument());
  });

  it("defaults to the current month with no query param", async () => {
    mockApi({
      "GET /api/chores": { body: { chores: [] } },
      "GET /api/reminders": { body: { reminders: [] } },
    });
    renderPage("/calendar");
    await waitFor(() => expect(screen.getByText(/2026/)).toBeInTheDocument());
  });
});
