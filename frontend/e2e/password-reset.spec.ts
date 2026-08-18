import { test, expect } from "@playwright/test";
import { signupNewHousehold } from "./fixtures/household";
import { findPasswordResetLink } from "./fixtures/mailpit";

test.describe("forgot/reset password", () => {
  test("requesting a reset link, following it, and logging in with the new password", async ({
    page,
    request,
  }) => {
    const owner = await signupNewHousehold(page, "reset");

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL("/login");

    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page).toHaveURL("/forgot-password");
    await page.getByLabel("Email").fill(owner.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/reset link is on its way/)).toBeVisible();

    const link = await findPasswordResetLink(request, owner.email);
    await page.goto(link);

    await page.getByLabel("New password").fill("brand-new-e2e-password");
    await page.getByRole("button", { name: "Reset password" }).click();
    await expect(page.getByText("Password reset")).toBeVisible();

    await page.getByRole("button", { name: "Go to sign in" }).click();
    await expect(page).toHaveURL("/login");

    await page.getByLabel("Email").fill(owner.email);
    await page.getByLabel("Password").fill("brand-new-e2e-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: `Hi, 🙂 ${owner.name}` })).toBeVisible();
  });

  test("a bogus reset token shows an error, not a crash", async ({ page }) => {
    await page.goto("/reset-password/this-token-does-not-exist");
    await page.getByLabel("New password").fill("brand-new-e2e-password");
    await page.getByRole("button", { name: "Reset password" }).click();

    await expect(page.getByRole("alert")).toHaveText("this password reset link is invalid or has expired");
  });
});
