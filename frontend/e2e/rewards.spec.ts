import { test, expect } from "@playwright/test";
import { signupNewHousehold } from "./fixtures/household";

test.describe("reward creation and redemption", () => {
  test("hoh creates a reward; a member without enough points can't redeem it", async ({ page }) => {
    await signupNewHousehold(page, "rewards");

    await page.getByRole("link", { name: "Rewards" }).click();
    await page.getByPlaceholder("Title").fill("Movie night");
    await page.getByPlaceholder("Point cost").fill("100");
    await page.getByRole("button", { name: "Add reward" }).click();

    await expect(page.getByText("Movie night").first()).toBeVisible();
    await expect(page.getByText("100 pts").first()).toBeVisible();

    // The signed-up hoh starts with 0 points, so redeeming a 100pt reward
    // must be blocked client-side (disabled button, no request fired).
    const card = page.locator("div").filter({ hasText: "Movie night" }).first();
    await expect(card.getByRole("button", { name: "Not enough points" })).toBeDisabled();
  });

  test("deactivating a reward removes it from the redeemable list but keeps it in management", async ({
    page,
  }) => {
    await signupNewHousehold(page, "reward-toggle");

    await page.getByRole("link", { name: "Rewards" }).click();
    await page.getByPlaceholder("Title").fill("Extra screen time");
    await page.getByPlaceholder("Point cost").fill("5");
    await page.getByRole("button", { name: "Add reward" }).click();
    await expect(page.getByText("Extra screen time").first()).toBeVisible();

    const manageRow = page
      .locator("section", { has: page.getByRole("heading", { name: "Manage rewards" }) })
      .locator("div")
      .filter({ hasText: "Extra screen time" })
      .first();
    await manageRow.getByRole("button", { name: "Archive" }).click();

    const redeemSection = page.locator("section", { has: page.getByRole("heading", { name: "Rewards", exact: true }) });
    await expect(redeemSection.getByText("Extra screen time")).toHaveCount(0);
    await expect(manageRow.getByText("Extra screen time")).toBeVisible();
  });
});
