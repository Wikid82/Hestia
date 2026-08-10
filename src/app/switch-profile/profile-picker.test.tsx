// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ProfilePicker } from "./profile-picker.tsx";

vi.mock("@/lib/actions/profile", () => ({
  switchProfile: vi.fn(async () => null),
}));

const profiles = [
  { id: "u1", name: "Jeremy", avatarEmoji: "🙂", role: "admin", hasPin: true },
  { id: "u2", name: "Kid", avatarEmoji: "🧒", role: "member", hasPin: false },
] as never;

test("renders a grid of all profiles", () => {
  render(<ProfilePicker profiles={profiles} />);
  expect(screen.getByRole("button", { name: /Jeremy/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Kid/ })).toBeInTheDocument();
});

test("selecting a profile without a PIN shows the continue form with no PIN field", async () => {
  const user = userEvent.setup();
  render(<ProfilePicker profiles={profiles} />);

  await user.click(screen.getByRole("button", { name: /Kid/ }));

  expect(screen.getByText("Kid")).toBeInTheDocument();
  expect(screen.queryByPlaceholderText("PIN")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
});

test("selecting a profile with a PIN shows the PIN input", async () => {
  const user = userEvent.setup();
  render(<ProfilePicker profiles={profiles} />);

  await user.click(screen.getByRole("button", { name: /Jeremy/ }));

  expect(screen.getByPlaceholderText("PIN")).toBeInTheDocument();
});

test("Back returns to the profile grid", async () => {
  const user = userEvent.setup();
  render(<ProfilePicker profiles={profiles} />);

  await user.click(screen.getByRole("button", { name: /Jeremy/ }));
  await user.click(screen.getByRole("button", { name: "Back" }));

  expect(screen.getByRole("button", { name: /Kid/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
});
