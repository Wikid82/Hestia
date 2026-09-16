import { test, expect } from "@playwright/test";
import { signupNewHousehold } from "./fixtures/household";

// Real push *delivery* isn't e2e-able here — it requires a live browser
// push service (FCM/Mozilla autopush) a CI runner has no meaningful way to
// assert against, and issue #39's own acceptance criteria ("works on
// iOS/Android") is an inherently manual, real-device check. It turns out
// even *subscribing* isn't e2e-able either: PushManager.subscribe() itself
// registers with the real push service over the network, which a locked-
// down CI runner can't reach. So PushManager.prototype.subscribe/
// getSubscription are stubbed via addInitScript below — this spec
// exercises the real UI, the real /api/push/subscribe +
// /api/push/unsubscribe round trip against the real backend, and real
// persistence, without depending on external push infrastructure being
// reachable. See docs/current_spec.md's Commit 5 note.
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

    // .click() + an explicit wait, not .check(): the enable/disable
    // mutations are multi-step (permission request, VAPID key fetch,
    // service worker, subscribe/unsubscribe, backend POST), and
    // Playwright's .check()/.uncheck() expect the checked property to
    // flip immediately off the native click rather than after an async
    // chain settles.
    await toggle.click();
    await expect(toggle).toBeChecked({ timeout: 10_000 });

    await toggle.click();
    await expect(toggle).not.toBeChecked({ timeout: 10_000 });

    // Reload: the unsubscribe actually took, not just local state.
    await page.reload();
    await expect(page.getByRole("checkbox", { name: "Push notifications" })).not.toBeChecked();
  });
});
