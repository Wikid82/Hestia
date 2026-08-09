import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

// One long journey through the whole app rather than many small isolated
// tests — each phase depends on state the previous phase created (a
// household, a member, a chore), so splitting it up would mean re-deriving
// that state repeatedly for little isolation benefit. Split further once
// there's enough surface area that failure localization actually matters.
test("household signup through chores, rewards, and reminders", async ({
  page,
}) => {
  const email = `admin-${randomUUID()}@example.com`;

  await test.step("sign up a new household", async () => {
    await page.goto("/signup");
    await page.getByLabel("Household name").fill("The Testfields");
    await page.getByLabel("Your name").fill("Admin Parent");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("supersecret123");
    await page.getByRole("button", { name: "Create household" }).click();
    await page.waitForURL("/");
    await expect(page.getByRole("heading", { name: /Hi, .*Admin Parent/ })).toBeVisible();
  });

  await test.step("add a kid profile and a PIN-protected admin profile", async () => {
    await page.goto("/household");
    const addForm = page.locator("form", { hasText: "Add member" });

    await addForm.getByPlaceholder("Name").fill("Junior");
    await addForm.getByRole("button", { name: "Add member" }).click();
    await expect(page.getByText("Junior")).toBeVisible();

    await addForm.getByPlaceholder("Name").fill("Co-Parent");
    await addForm.locator('select[name="role"]').selectOption("admin");
    await addForm.getByPlaceholder("PIN (optional)").fill("4321");
    await addForm.getByRole("button", { name: "Add member" }).click();
    await expect(page.getByText("Co-Parent")).toBeVisible();
  });

  await test.step("create a daily chore assigned to Junior", async () => {
    await page.goto("/chores");
    const choreForm = page.locator("form", { hasText: "Add chore" });

    await choreForm.getByPlaceholder("Title").fill("Clean room");
    const assigneeOptions = await choreForm
      .locator('select[name="assignedToUserId"] option')
      .allTextContents();
    const juniorOption = assigneeOptions.find((o) => o.includes("Junior"));
    expect(juniorOption).toBeTruthy();
    await choreForm
      .locator('select[name="assignedToUserId"]')
      .selectOption({ label: juniorOption! });
    await choreForm.getByPlaceholder("Points").fill("10");
    await choreForm.locator('select[name="recurrence"]').selectOption("daily");
    await choreForm.getByRole("button", { name: "Add chore" }).click();
    await expect(page.getByText("Clean room").first()).toBeVisible();
  });

  await test.step("switch to Junior (no PIN) and complete the chore", async () => {
    await page.goto("/switch-profile");
    await page.getByRole("button", { name: "Junior" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL("/");

    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(page.locator("header")).toContainText("10 pts");
  });

  await test.step("switch to Co-Parent: wrong PIN rejected, right PIN accepted", async () => {
    await page.goto("/switch-profile");
    await page.getByRole("button", { name: "Co-Parent" }).click();
    await page.getByPlaceholder("PIN").fill("0000");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Incorrect PIN")).toBeVisible();

    await page.getByPlaceholder("PIN").fill("4321");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL("/");
    await expect(page.getByRole("heading", { name: /Hi, .*Co-Parent/ })).toBeVisible();
  });

  await test.step("create a reward as Co-Parent", async () => {
    await page.goto("/rewards");
    const rewardForm = page.locator("form", { hasText: "Add reward" });
    await rewardForm.getByPlaceholder("Title").fill("Extra screen time");
    await rewardForm.getByPlaceholder("Point cost").fill("5");
    await rewardForm.getByRole("button", { name: "Add reward" }).click();
    await expect(page.getByText("Extra screen time").first()).toBeVisible();
  });

  await test.step("switch back to Junior and redeem the reward", async () => {
    await page.goto("/switch-profile");
    await page.getByRole("button", { name: "Junior" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL("/");

    await page.goto("/rewards");
    await expect(page.getByText("You have 10 pts")).toBeVisible();
    await page.getByRole("button", { name: "Redeem" }).click();
    await expect(page.getByText("You have 5 pts")).toBeVisible();
  });

  await test.step("calendar shows the chore on today's date", async () => {
    await page.goto("/calendar");
    await expect(page.getByText("Clean room").first()).toBeVisible();
  });

  await test.step("reminders: create and toggle done", async () => {
    await page.goto("/reminders");
    const reminderForm = page.locator("form", { hasText: "Add reminder" });
    await reminderForm.getByPlaceholder("Title").fill("Take out trash");
    await reminderForm.getByRole("button", { name: "Add reminder" }).click();
    await expect(page.getByText("Take out trash")).toBeVisible();

    await page.getByRole("button", { name: "Mark done" }).click();
    await expect(page.getByText("Take out trash")).toHaveClass(/line-through/);
  });
});
