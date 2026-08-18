import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockApi } from "@/test/mockApi";
import { MemberCard } from "./MemberCard";
import type { Profile } from "@/types";

afterEach(() => {
  vi.unstubAllGlobals();
});

const member: Profile = {
  id: "m1",
  householdId: "h1",
  name: "Kid",
  avatarEmoji: "🦊",
  role: "member",
  isSystemAdmin: false,
  points: 10,
  createdAt: "2026-08-01",
  hasPin: true,
  email: null,
};

function renderCard(m: Profile = member) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberCard member={m} />
    </QueryClientProvider>,
  );
}

describe("MemberCard", () => {
  it("shows name, role, points, and login status in view mode", () => {
    renderCard({ ...member, email: "kid@example.com" });
    expect(screen.getByText("Kid")).toBeInTheDocument();
    expect(screen.getByText(/Kid \/ member/)).toBeInTheDocument();
    expect(screen.getByText(/has own login/)).toBeInTheDocument();
  });

  it("enters edit mode and cancels", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByText("Edit"));
    expect(screen.getByDisplayValue("Kid")).toBeInTheDocument();
    await user.click(screen.getByText("Cancel"));
    expect(screen.queryByDisplayValue("Kid")).not.toBeInTheDocument();
  });

  it("saves an edit and clears the pin field", async () => {
    const user = userEvent.setup();
    mockApi({ "PATCH /api/members/m1": { body: { ...member, name: "Kiddo" } } });
    renderCard();
    await user.click(screen.getByText("Edit"));
    const nameInput = screen.getByDisplayValue("Kid");
    await user.clear(nameInput);
    await user.type(nameInput, "Kiddo");
    await user.click(screen.getByText("Save"));
    await waitFor(() => expect(screen.queryByDisplayValue("Kiddo")).not.toBeInTheDocument());
  });

  it("shows an error when save fails", async () => {
    const user = userEvent.setup();
    mockApi({ "PATCH /api/members/m1": { status: 400, body: { error: "Name required" } } });
    renderCard();
    await user.click(screen.getByText("Edit"));
    await user.click(screen.getByText("Save"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Name required"));
  });

  it("shows Clear PIN only when member.hasPin, and clears it", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ "DELETE /api/members/m1/pin": { body: { ok: true } } });
    renderCard();
    await user.click(screen.getByText("Edit"));
    expect(screen.getByText("Clear PIN")).toBeInTheDocument();
    await user.click(screen.getByText("Clear PIN"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/members/m1/pin",
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("hides Clear PIN when member has no pin", async () => {
    const user = userEvent.setup();
    renderCard({ ...member, hasPin: false });
    await user.click(screen.getByText("Edit"));
    expect(screen.queryByText("Clear PIN")).not.toBeInTheDocument();
  });

  it("deletes on click from view mode", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ "DELETE /api/members/m1": { body: { ok: true } } });
    renderCard();
    await user.click(screen.getByText("Remove"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/members/m1", expect.objectContaining({ method: "DELETE" })),
    );
  });

  it("shows a delete error message", async () => {
    const user = userEvent.setup();
    mockApi({ "DELETE /api/members/m1": { status: 400, body: { error: "Cannot remove yourself" } } });
    renderCard();
    await user.click(screen.getByText("Remove"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Cannot remove yourself"));
  });

  it("shows 'Set up login' when no email, and 'Reset login' when one exists", async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByText("Edit"));
    expect(screen.getByText("Set up login")).toBeInTheDocument();
    cleanup();

    renderCard({ ...member, email: "kid@example.com" });
    await user.click(screen.getByText("Edit"));
    expect(screen.getByText("Reset login")).toBeInTheDocument();
  });

  it("expands credential editing, submits, and returns to the button on success", async () => {
    const user = userEvent.setup();
    mockApi({ "PATCH /api/members/m1/credentials": { body: { ...member, email: "kid@example.com" } } });
    renderCard();
    await user.click(screen.getByText("Edit"));
    await user.click(screen.getByText("Set up login"));

    await user.type(screen.getByPlaceholderText("email@example.com"), "kid@example.com");
    await user.type(screen.getByPlaceholderText("Password (at least 8 characters)"), "hunter22");
    await user.click(screen.getByRole("button", { name: "Set up login" }));

    await waitFor(() => expect(screen.queryByPlaceholderText("email@example.com")).not.toBeInTheDocument());
  });

  it("shows a credentials error and cancels credential editing", async () => {
    const user = userEvent.setup();
    mockApi({ "PATCH /api/members/m1/credentials": { status: 400, body: { error: "Email taken" } } });
    renderCard();
    await user.click(screen.getByText("Edit"));
    await user.click(screen.getByText("Set up login"));
    await user.type(screen.getByPlaceholderText("email@example.com"), "kid@example.com");
    await user.type(screen.getByPlaceholderText("Password (at least 8 characters)"), "hunter22");
    await user.click(screen.getByRole("button", { name: "Set up login" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Email taken"));

    const cancelButtons = screen.getAllByText("Cancel");
    await user.click(cancelButtons[cancelButtons.length - 1]);
    expect(screen.queryByPlaceholderText("email@example.com")).not.toBeInTheDocument();
  });
});
