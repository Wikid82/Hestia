import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export type NewHousehold = {
  householdName: string;
  name: string;
  email: string;
  password: string;
};

// Signs up a brand-new, isolated household through the real UI (the app's
// signup flow itself, not a shortcut) — see docs/current_spec.md Decision
// 8. Each caller gets its own household with no shared fixture data to
// collide with other specs, safe under workers: 1 serial execution.
// Requires ALLOW_PUBLIC_SIGNUP=true in the running container (set by
// docker-compose.e2e.yml) since this always runs after global-setup's own
// first-user signup has already claimed the instance's one free pass.
export function newHouseholdInput(label: string): NewHousehold {
  const unique = `${label}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  return {
    householdName: `E2E ${label} Household`,
    name: `E2E ${label}`,
    email: `${unique}@example.com`,
    password: "e2e-test-password",
  };
}

export async function signupNewHousehold(page: Page, label: string): Promise<NewHousehold> {
  const input = newHouseholdInput(label);

  await page.goto("/signup");
  await page.getByLabel("Household name").fill(input.householdName);
  await page.getByLabel("Your name").fill(input.name);
  await page.getByLabel("Email").fill(input.email);
  await page.getByLabel("Password").fill(input.password);
  await page.getByRole("button", { name: "Create household" }).click();

  await expect(page).toHaveURL("/");
  return input;
}
