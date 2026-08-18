import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockApi } from "@/test/mockApi";
import { RewardForm } from "./RewardForm";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RewardForm />
    </QueryClientProvider>,
  );
}

describe("RewardForm", () => {
  it("submits title, description, and pointCost, then resets the form", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({
      "POST /api/rewards": { body: { id: "rw1", title: "Movie night", pointCost: 10 } },
    });
    renderForm();

    await user.type(screen.getByPlaceholderText("Title"), "Movie night");
    await user.type(screen.getByPlaceholderText("Description (optional)"), "Any movie");
    const pointInput = screen.getByPlaceholderText("Point cost");
    await user.clear(pointInput);
    await user.type(pointInput, "10");
    await user.click(screen.getByRole("button", { name: "Add reward" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/rewards",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ title: "Movie night", description: "Any movie", pointCost: 10 }),
        }),
      ),
    );
    await waitFor(() => expect(screen.getByPlaceholderText("Title")).toHaveValue(""));
  });

  it("shows an error message on failure", async () => {
    const user = userEvent.setup();
    mockApi({ "POST /api/rewards": { status: 400, body: { error: "Title required" } } });
    renderForm();

    await user.type(screen.getByPlaceholderText("Title"), "x");
    await user.click(screen.getByRole("button", { name: "Add reward" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Title required"));
  });
});
