import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { InviteList } from "./InviteList";
import type { Invite } from "@/types";

function invite(overrides: Partial<Invite> = {}): Invite {
  return {
    id: "i1",
    role: "member",
    email: "a@example.com",
    status: "pending",
    invitedByUserId: "u1",
    expiresAt: "2026-09-01",
    createdAt: "2026-08-01",
    ...overrides,
  };
}

describe("InviteList", () => {
  it("shows an empty state when there are no invites", () => {
    render(<InviteList invites={[]} onRevoke={vi.fn()} />);
    expect(screen.getByText("No invites yet.")).toBeInTheDocument();
  });

  it("renders each invite's email and status", () => {
    render(
      <InviteList
        invites={[invite({ id: "i1", status: "pending" }), invite({ id: "i2", status: "accepted", email: "b@example.com" })]}
        onRevoke={vi.fn()}
      />,
    );
    expect(screen.getByText("a@example.com")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("b@example.com")).toBeInTheDocument();
    expect(screen.getByText("Accepted")).toBeInTheDocument();
  });

  it("only shows Revoke for pending invites and calls onRevoke with its id", async () => {
    const user = userEvent.setup();
    const onRevoke = vi.fn();
    render(
      <InviteList
        invites={[invite({ id: "i1", status: "pending" }), invite({ id: "i2", status: "revoked" })]}
        onRevoke={onRevoke}
      />,
    );
    const revokeButtons = screen.getAllByRole("button", { name: "Revoke" });
    expect(revokeButtons).toHaveLength(1);
    await user.click(revokeButtons[0]);
    expect(onRevoke).toHaveBeenCalledWith("i1");
  });

  it("disables Revoke for the invite currently being revoked", () => {
    render(<InviteList invites={[invite({ id: "i1" })]} onRevoke={vi.fn()} revokingId="i1" />);
    expect(screen.getByRole("button", { name: "Revoke" })).toBeDisabled();
  });
});
