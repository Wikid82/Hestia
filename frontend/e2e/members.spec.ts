import { test, expect } from "@playwright/test";
import { signupNewHousehold } from "./fixtures/household";

test.describe("member management", () => {
  test("editing a member's name and removing a member both work", async ({ page }) => {
    await signupNewHousehold(page, "members");

    await page.getByRole("link", { name: "Household" }).click();
    await page.getByPlaceholder("Name").fill("Original Name");
    await page.getByRole("button", { name: "Add member" }).click();
    await expect(page.getByText("Original Name")).toBeVisible();

    const card = page
      .getByText("Original Name", { exact: true })
      .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
    await card.getByRole("button", { name: "Edit" }).click();
    const editForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Save" }) });
    await editForm.locator('input[name="name"]').fill("Renamed Kid");
    await editForm.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Renamed Kid")).toBeVisible();
    await expect(page.getByText("Original Name")).toHaveCount(0);

    const renamedCard = page
      .getByText("Renamed Kid", { exact: true })
      .locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
    await renamedCard.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Renamed Kid")).toHaveCount(0);
  });

  test("household name can be renamed", async ({ page }) => {
    await signupNewHousehold(page, "rename");

    await page.getByRole("link", { name: "Household" }).click();
    const nameHeading = page.locator("h1").locator("xpath=..");
    await nameHeading.getByRole("button", { name: "Edit" }).click();
    const renameForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Save" }) });
    await renameForm.locator('input[name="name"]').fill("The Renamed Household");
    await renameForm.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("heading", { name: "The Renamed Household" })).toBeVisible();
  });
});
