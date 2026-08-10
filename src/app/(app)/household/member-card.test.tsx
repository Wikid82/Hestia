// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";
import { MemberCard } from "./member-card.tsx";

vi.mock("@/lib/actions/members", () => ({
  updateMember: vi.fn(async () => null),
  clearMemberPin: vi.fn(async () => undefined),
  deleteMember: vi.fn(async () => undefined),
}));

function makeMember(overrides = {}) {
  return {
    id: "u1",
    householdId: "h1",
    name: "Jeremy",
    avatarEmoji: "🙂",
    role: "admin",
    email: null,
    passwordHash: null,
    pinHash: null,
    points: 10,
    createdAt: new Date(),
    ...overrides,
  } as never;
}

test("shows role, points, and a main login note for the account holder", () => {
  render(
    <MemberCard
      member={makeMember({ role: "admin", passwordHash: "hash", points: 10 })}
    />,
  );

  expect(screen.getByText("Jeremy")).toBeInTheDocument();
  expect(screen.getByText(/Parent \/ admin/)).toBeInTheDocument();
  expect(screen.getByText(/10 pts/)).toBeInTheDocument();
  expect(screen.getByText(/main login/)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Remove" }),
  ).not.toBeInTheDocument();
});

test("shows a Remove button for members without a login", () => {
  render(
    <MemberCard
      member={makeMember({ role: "member", passwordHash: null, name: "Kid" })}
    />,
  );

  expect(screen.getByText(/Kid \/ member/)).toBeInTheDocument();
  expect(screen.queryByText(/main login/)).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
});

test("clicking Edit reveals a prefilled form with a Clear PIN button when a PIN is set", async () => {
  const user = userEvent.setup();
  render(<MemberCard member={makeMember({ name: "Kid", pinHash: "hash" })} />);

  await user.click(screen.getByRole("button", { name: "Edit" }));

  expect(screen.getByDisplayValue("Kid")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Clear PIN" }),
  ).toBeInTheDocument();
});

test("hides Clear PIN when no PIN is set", async () => {
  const user = userEvent.setup();
  render(<MemberCard member={makeMember({ pinHash: null })} />);

  await user.click(screen.getByRole("button", { name: "Edit" }));

  expect(
    screen.queryByRole("button", { name: "Clear PIN" }),
  ).not.toBeInTheDocument();
});

test("Cancel returns to the display view", async () => {
  const user = userEvent.setup();
  render(<MemberCard member={makeMember()} />);

  await user.click(screen.getByRole("button", { name: "Edit" }));
  expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Cancel" }));

  expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
});

test("shows an error returned by the update action", async () => {
  const { updateMember } = await import("@/lib/actions/members");
  vi.mocked(updateMember).mockResolvedValueOnce({ error: "Name is required." });
  const user = userEvent.setup();
  render(<MemberCard member={makeMember()} />);

  await user.click(screen.getByRole("button", { name: "Edit" }));
  await user.click(screen.getByRole("button", { name: "Save" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Name is required.",
  );
});
