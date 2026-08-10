// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { AddMemberForm } from "./add-member-form.tsx";

vi.mock("@/lib/actions/members", () => ({
  createMember: vi.fn(async () => null),
}));

test("renders the member fields with sensible defaults", () => {
  render(<AddMemberForm />);

  expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("PIN (optional)")).toBeInTheDocument();
  expect(
    screen.getByRole("option", { name: "Kid / member" }).parentElement,
  ).toHaveValue("member");
  expect(screen.getByRole("button", { name: "Add member" })).toBeEnabled();
});

test("submits the form and shows the error returned by createMember", async () => {
  const { createMember } = await import("@/lib/actions/members");
  vi.mocked(createMember).mockResolvedValueOnce({ error: "Name is required" });
  const user = userEvent.setup();
  render(<AddMemberForm />);

  await user.type(screen.getByPlaceholderText("Name"), "Kid One");
  await user.click(screen.getByRole("button", { name: "Add member" }));

  expect(createMember).toHaveBeenCalled();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Name is required",
  );
});

test("shows no error message before the form has been submitted", () => {
  render(<AddMemberForm />);
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("lets the role be switched to Parent / admin", async () => {
  const user = userEvent.setup();
  render(<AddMemberForm />);

  const roleSelect = screen.getByRole("option", {
    name: "Parent / admin",
  }).parentElement as HTMLSelectElement;
  await user.selectOptions(roleSelect, "admin");

  expect(roleSelect).toHaveValue("admin");
});
