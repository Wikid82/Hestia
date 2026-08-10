// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { HouseholdName } from "./household-name.tsx";

vi.mock("@/lib/actions/household", () => ({
  renameHousehold: vi.fn(async () => null),
}));

test("shows the household name and an Edit button", () => {
  render(<HouseholdName name="The Hatfields" />);

  expect(screen.getByText("The Hatfields")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

test("switches to an editable input pre-filled with the current name", async () => {
  const user = userEvent.setup();
  render(<HouseholdName name="The Hatfields" />);

  await user.click(screen.getByRole("button", { name: "Edit" }));

  expect(screen.getByRole("textbox")).toHaveValue("The Hatfields");
  expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Edit" }),
  ).not.toBeInTheDocument();
});

test("Cancel returns to the display view without saving", async () => {
  const user = userEvent.setup();
  render(<HouseholdName name="The Hatfields" />);

  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.click(screen.getByRole("button", { name: "Cancel" }));

  expect(screen.getByText("The Hatfields")).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});

test("shows the error returned by renameHousehold and stays in edit mode", async () => {
  const { renameHousehold } = await import("@/lib/actions/household");
  vi.mocked(renameHousehold).mockResolvedValueOnce({ error: "Name is required" });
  const user = userEvent.setup();
  render(<HouseholdName name="The Hatfields" />);

  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.click(screen.getByRole("button", { name: "Save" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Name is required",
  );
  expect(screen.getByRole("textbox")).toBeInTheDocument();
});

test("returns to the display view after a successful save", async () => {
  const { renameHousehold } = await import("@/lib/actions/household");
  vi.mocked(renameHousehold).mockResolvedValueOnce(null);
  const user = userEvent.setup();
  render(<HouseholdName name="The Hatfields" />);

  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.click(screen.getByRole("button", { name: "Save" }));

  expect(
    await screen.findByRole("button", { name: "Edit" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
