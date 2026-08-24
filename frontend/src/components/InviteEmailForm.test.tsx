import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { InviteEmailForm } from "./InviteEmailForm";

describe("InviteEmailForm", () => {
  it("submits the entered email and clears the field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<InviteEmailForm onSubmit={onSubmit} pending={false} error={null} submitLabel="Invite" />);

    const input = screen.getByPlaceholderText("email@example.com") as HTMLInputElement;
    await user.type(input, "friend@example.com");
    await user.click(screen.getByRole("button", { name: "Invite" }));

    expect(onSubmit).toHaveBeenCalledWith("friend@example.com");
    expect(input.value).toBe("");
  });

  it("shows pending label and disables the button while pending", () => {
    render(<InviteEmailForm onSubmit={vi.fn()} pending error={null} submitLabel="Invite" />);
    const button = screen.getByRole("button", { name: "Sending..." });
    expect(button).toBeDisabled();
  });

  it("renders an error message when provided", () => {
    render(<InviteEmailForm onSubmit={vi.fn()} pending={false} error="Already invited" submitLabel="Invite" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Already invited");
  });
});
