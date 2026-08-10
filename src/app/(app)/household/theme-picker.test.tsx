// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { ThemePicker } from "./theme-picker.tsx";

vi.mock("@/lib/actions/household", () => ({
  updateThemePreference: vi.fn(async () => null),
}));

test("marks the current preference as checked", () => {
  render(<ThemePicker value="dark" />);
  expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
  expect(screen.getByRole("radio", { name: "Light" })).not.toBeChecked();
});

test("submits the action when a different option is picked", async () => {
  const { updateThemePreference } = await import("@/lib/actions/household");
  const user = userEvent.setup();
  render(<ThemePicker value="system" />);

  await user.click(screen.getByRole("radio", { name: "Dark" }));

  expect(updateThemePreference).toHaveBeenCalled();
});
