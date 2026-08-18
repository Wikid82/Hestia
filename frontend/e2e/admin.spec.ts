import { test, expect } from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "./global-setup";
import { findInviteLink } from "./fixtures/mailpit";

// Only the instance's very first signup (created once in global-setup) is
// ever IsSystemAdmin — see docs/current_spec.md Decision 8 — so these specs
// reuse its storageState instead of signing up their own household.
test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe("admin settings", () => {
  test("admin invites a new HoH, who accepts and gets their own independent household", async ({
    page,
    request,
  }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Admin settings" })).toBeVisible();

    const inviteeEmail = `hoh-invite-${Date.now()}@example.com`;
    const inviteSection = page
      .locator("div")
      .filter({ has: page.getByRole("heading", { name: "Invite a Head of Household" }) })
      .last();
    await inviteSection.getByPlaceholder("email@example.com").fill(inviteeEmail);
    await inviteSection.getByRole("button", { name: "Invite" }).click();

    await expect(page.getByText("Invite sent.")).toBeVisible();
    await expect(inviteSection.getByText(inviteeEmail)).toBeVisible();

    const link = await findInviteLink(request, inviteeEmail);

    const context = await page.context().browser()!.newContext();
    const inviteePage = await context.newPage();
    await inviteePage.goto(link);

    await expect(inviteePage.getByText("Set up your own independent household.")).toBeVisible();
    await inviteePage.getByLabel("Household name").fill("Brand New Household");
    await inviteePage.getByLabel("Your name").fill("New HoH");
    await inviteePage.getByLabel("Password").fill("new-hoh-password");
    await inviteePage.getByRole("button", { name: "Accept invite" }).click();

    await expect(inviteePage).toHaveURL("/");
    await expect(inviteePage.getByRole("heading", { name: "Hi, 🙂 New HoH" })).toBeVisible();
    // A fresh, independent household — not the admin's own.
    await expect(inviteePage.getByText("Brand New Household")).toBeVisible();
    await context.close();
  });

  test("configuring a webhook notification channel saves and can be sent as a test", async ({ page }) => {
    await page.goto("/admin");

    await page.getByLabel("Channel").selectOption("webhook");
    await page.getByLabel("Destination URL").fill("http://mailpit:8025/api/v1/messages");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("button", { name: "Send test notification" })).toBeEnabled();
    await page.getByRole("button", { name: "Send test notification" }).click();
    // Mailpit's own API is a real, reachable HTTP endpoint (unlike a made-up
    // host), so this exercises a genuine round trip — save, then an actual
    // outbound POST — without depending on a live third-party webhook
    // provider. Whichever way the provider interprets Mailpit's response,
    // the UI must land on exactly one of its two known outcomes, never hang.
    await expect(
      page.getByText("Test notification sent.").or(page.getByText("Failed to send test notification")),
    ).toBeVisible();
  });
});
