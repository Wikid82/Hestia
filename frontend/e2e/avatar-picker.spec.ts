import { test, expect } from "@playwright/test";
import { signupNewHousehold } from "./fixtures/household";

test.describe("avatar picker / profile switching", () => {
  test("switching to a PIN-less member logs straight in, switching back to the picker works", async ({
    page,
  }) => {
    await signupNewHousehold(page, "picker");

    await page.getByRole("link", { name: "Household" }).click();
    await page.getByPlaceholder("Name").fill("Kiddo");
    await page.getByRole("button", { name: "Add member" }).click();
    await expect(page.getByText("Kiddo")).toBeVisible();

    await page.getByRole("button", { name: "Switch" }).click();
    await expect(page).toHaveURL("/switch-profile");
    await page.getByText("Kiddo").click();
    await page.getByRole("button", { name: "Continue" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Hi, 🙂 Kiddo" })).toBeVisible();
  });

  test("a PIN-gated profile requires the correct PIN to switch into", async ({ page }) => {
    await signupNewHousehold(page, "pin");

    await page.getByRole("link", { name: "Household" }).click();
    await page.getByPlaceholder("Name").fill("Guarded Kid");
    await page.getByPlaceholder("PIN (optional)").fill("4242");
    await page.getByRole("button", { name: "Add member" }).click();
    await expect(page.getByText("Guarded Kid")).toBeVisible();

    await page.getByRole("button", { name: "Switch" }).click();
    await page.getByText("Guarded Kid").click();

    await page.getByPlaceholder("PIN").fill("0000");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("alert")).toHaveText("incorrect PIN");

    await page.getByPlaceholder("PIN").fill("4242");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Hi, 🙂 Guarded Kid" })).toBeVisible();
  });
});
