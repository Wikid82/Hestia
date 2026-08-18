import { test, expect } from "@playwright/test";
import { signupNewHousehold } from "./fixtures/household";

test.describe("chore CRUD and completion", () => {
  test("hoh creates, completes, and deletes a chore", async ({ page }) => {
    const { name } = await signupNewHousehold(page, "chores");

    await page.getByRole("link", { name: "Chores" }).click();
    const today = page.locator("section", { has: page.getByRole("heading", { name: "Today" }) });
    const allChores = page.locator("section", { has: page.getByRole("heading", { name: "All chores" }) });

    await page.getByPlaceholder("Title").fill("Take out trash");
    await page.locator('select[name="assignedToUserId"]').selectOption({ label: `🙂 ${name}` });
    await page.getByPlaceholder("Points").fill("10");
    await page.getByRole("button", { name: "Add chore" }).click();

    await expect(allChores.getByText("Take out trash")).toBeVisible();

    // Due today (dueDate defaults to today), so it also shows in the
    // "Today" section with a Done button.
    await today.getByRole("button", { name: "Done" }).click();
    await expect(today.getByText("Take out trash")).toHaveClass(/line-through/);

    const row = allChores.locator("div").filter({ hasText: "Take out trash" }).first();
    await row.getByRole("button", { name: "Delete" }).click();
    await expect(allChores.getByText("Take out trash")).toHaveCount(0);
  });

  test("editing a chore updates its title", async ({ page }) => {
    const { name } = await signupNewHousehold(page, "chore-edit");

    await page.getByRole("link", { name: "Chores" }).click();
    const allChores = page.locator("section", { has: page.getByRole("heading", { name: "All chores" }) });

    await page.getByPlaceholder("Title").fill("Wash dishes");
    await page.locator('select[name="assignedToUserId"]').selectOption({ label: `🙂 ${name}` });
    await page.getByPlaceholder("Points").fill("5");
    await page.getByRole("button", { name: "Add chore" }).click();
    await expect(allChores.getByText("Wash dishes")).toBeVisible();

    const row = allChores.locator("div").filter({ hasText: "Wash dishes" }).first();
    await row.getByRole("button", { name: "Edit" }).click();
    const editForm = allChores.locator("form").filter({ has: page.getByRole("button", { name: "Save" }) });
    await editForm.getByPlaceholder("Title").fill("Wash all the dishes");
    await editForm.getByRole("button", { name: "Save" }).click();

    await expect(allChores.getByText("Wash all the dishes")).toBeVisible();
    await expect(allChores.getByText("Wash dishes", { exact: true })).toHaveCount(0);
  });
});
