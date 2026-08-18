import { test, expect } from "@playwright/test";
import { signupNewHousehold } from "./fixtures/household";
import { findInviteLink } from "./fixtures/mailpit";

test.describe("member invite send + accept", () => {
  test("hoh invites a member by email; the invitee accepts and joins the household", async ({
    page,
    request,
  }) => {
    const owner = await signupNewHousehold(page, "invite-owner");
    const inviteeEmail = `invitee-${Date.now()}@example.com`;

    await page.getByRole("link", { name: "Household" }).click();
    const inviteSection = page.locator("div").filter({ has: page.getByRole("heading", { name: "Invite a member by email" }) }).last();
    await inviteSection.getByPlaceholder("email@example.com").fill(inviteeEmail);
    await inviteSection.getByRole("button", { name: "Invite" }).click();

    await expect(page.getByText("Invite sent.")).toBeVisible();
    await expect(page.getByText(inviteeEmail)).toBeVisible();
    await expect(page.getByText("Pending")).toBeVisible();

    const link = await findInviteLink(request, inviteeEmail);
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL("/login");

    await page.goto(link);
    await expect(page.getByText(`Join the "${owner.householdName}" household.`)).toBeVisible();
    await expect(page.getByText(inviteeEmail)).toBeVisible();

    await page.getByLabel("Your name").fill("Invited Member");
    await page.getByLabel("Password").fill("invitee-password");
    await page.getByRole("button", { name: "Accept invite" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Hi, 🙂 Invited Member" })).toBeVisible();
  });

  test("revoking a pending invite removes the Revoke button and marks it Revoked", async ({ page }) => {
    await signupNewHousehold(page, "invite-revoke");
    const inviteeEmail = `revoke-${Date.now()}@example.com`;

    await page.getByRole("link", { name: "Household" }).click();
    const inviteSection = page.locator("div").filter({ has: page.getByRole("heading", { name: "Invite a member by email" }) }).last();
    await inviteSection.getByPlaceholder("email@example.com").fill(inviteeEmail);
    await inviteSection.getByRole("button", { name: "Invite" }).click();
    await expect(page.getByText(inviteeEmail)).toBeVisible();

    await inviteSection.getByRole("button", { name: "Revoke" }).click();
    await expect(inviteSection.getByText("Revoked")).toBeVisible();
    await expect(inviteSection.getByRole("button", { name: "Revoke" })).toHaveCount(0);
  });

  test("a bogus invite token shows an invalid-invite message, not a crash", async ({ page }) => {
    await page.goto("/invite/this-token-does-not-exist");
    await expect(page.getByText("This invite link isn't valid.")).toBeVisible();
  });
});
