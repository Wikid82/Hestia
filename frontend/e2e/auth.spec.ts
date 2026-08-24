import { test, expect } from "@playwright/test";
import { signupNewHousehold } from "./fixtures/household";

test.describe("signup and login", () => {
  test("signing up creates a household and lands on the hub", async ({ page }) => {
    const input = await signupNewHousehold(page, "signup");
    await expect(page.getByRole("heading", { name: `Hi, 🙂 ${input.name}` })).toBeVisible();
  });

  test("logging out then back in returns to the hub", async ({ page }) => {
    const input = await signupNewHousehold(page, "login");

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL("/login");

    await page.getByLabel("Email").fill(input.email);
    await page.getByLabel("Password").fill(input.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: `Hi, 🙂 ${input.name}` })).toBeVisible();
  });

  test("logging in with the wrong password shows an error, no navigation", async ({ page }) => {
    const input = await signupNewHousehold(page, "badlogin");
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL("/login");

    await page.getByLabel("Email").fill(input.email);
    await page.getByLabel("Password").fill("wrong-password-entirely");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toHaveText("invalid email or password");
    await expect(page).toHaveURL("/login");
  });
});
