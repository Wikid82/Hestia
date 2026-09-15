import { test, expect } from "@playwright/test";
import { signupNewHousehold } from "./fixtures/household";

// Real push *delivery* isn't e2e-able here — it requires a live browser
// push service (FCM/Mozilla autopush) a CI runner has no meaningful way to
// assert against, and issue #39's own acceptance criteria ("works on
// iOS/Android") is an inherently manual, real-device check. It turns out
// even *subscribing* isn't e2e-able either: PushManager.subscribe() itself
// registers with the real push service over the network, which a locked-
// down CI runner can't reach (confirmed failure: "Clicking the checkbox
// did not change its state", because the real subscribe() call rejected).
// So PushManager.prototype.subscribe/getSubscription are stubbed via
// addInitScript below — this spec exercises the real UI, the real
// /api/push/subscribe + /api/push/unsubscribe round trip against the real
// backend, and real persistence, without depending on external push
// infrastructure being reachable. See docs/current_spec.md's Commit 5 note.
test.describe("Web Push subscribe/unsubscribe", () => {
  test("toggling on subscribes and toggling off unsubscribes", async ({ page, context }) => {
    await context.grantPermissions(["notifications"]);

    await page.addInitScript(() => {
      let fakeSubscription: { endpoint: string; toJSON: () => unknown; unsubscribe: () => Promise<boolean> } | null =
        null;

      const makeFakeSubscription = () => ({
        endpoint: "https://fake-push-service.e2e.test/endpoint",
        toJSON: () => ({
          endpoint: "https://fake-push-service.e2e.test/endpoint",
          keys: { p256dh: "ZmFrZS1wMjU2ZGg", auth: "ZmFrZS1hdXRo" },
        }),
        unsubscribe: async () => {
          fakeSubscription = null;
          return true;
        },
      });

      if ("PushManager" in window) {
        window.PushManager.prototype.subscribe = async function () {
          fakeSubscription = makeFakeSubscription();
          return fakeSubscription as unknown as PushSubscription;
        };
        window.PushManager.prototype.getSubscription = async function () {
          return fakeSubscription as unknown as PushSubscription;
        };
      }
    });

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
