import { test, expect } from "@playwright/test";
import { signupNewHousehold } from "./fixtures/household";

// Real push *delivery* isn't e2e-able here — it requires a live browser
// push service (FCM/Mozilla autopush) a CI runner has no meaningful way to
// assert against, and issue #39's own acceptance criteria ("works on
// iOS/Android") is an inherently manual, real-device check. This spec
// covers what is real e2e-able: the service worker registers, the
// Notifications toggle drives a real PushManager.subscribe() through to
// POST /api/push/subscribe, and unsubscribing removes it — see
// docs/current_spec.md's Commit 5 note.
test.describe("Web Push subscribe/unsubscribe", () => {
  test("toggling on subscribes and toggling off unsubscribes", async ({ page, context }) => {
    await context.grantPermissions(["notifications"]);
    await signupNewHousehold(page, "push");

    await page.waitForFunction(() => "serviceWorker" in navigator);
    await page.evaluate(() => navigator.serviceWorker.ready);

    await page.getByRole("link", { name: "Account" }).click();
    const toggle = page.getByRole("checkbox", { name: "Push notifications" });
    await expect(toggle).toBeVisible();
    await expect(toggle).not.toBeChecked();

    const subscribeRequest = page.waitForResponse(
      (res) => res.url().endsWith("/api/push/subscribe") && res.request().method() === "POST" && res.ok(),
    );
    await toggle.check();
    await subscribeRequest;
    await expect(toggle).toBeChecked();

    const unsubscribeRequest = page.waitForResponse(
      (res) => res.url().endsWith("/api/push/unsubscribe") && res.request().method() === "POST" && res.ok(),
    );
    await toggle.uncheck();
    await unsubscribeRequest;
    await expect(toggle).not.toBeChecked();

    // Reload: the unsubscribe actually took, not just local state.
    await page.reload();
    await expect(page.getByRole("checkbox", { name: "Push notifications" })).not.toBeChecked();
  });
});
