import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "@/test/mockApi";
import * as admin from "./admin";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin api", () => {
  it("getNotificationSettings gets /admin/notification-settings", async () => {
    mockApi({
      "GET /api/admin/notification-settings": { body: { provider: "none", config: {} } },
    });
    await expect(admin.getNotificationSettings()).resolves.toEqual({
      provider: "none",
      config: {},
    });
  });

  it("updateNotificationSettings puts /admin/notification-settings", async () => {
    const fetchMock = mockApi({
      "PUT /api/admin/notification-settings": { body: { provider: "smtp", config: {} } },
    });
    await admin.updateNotificationSettings({ provider: "webhook", config: { host: "localhost" } });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/notification-settings",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  it("testNotificationSettings posts /admin/notification-settings/test", async () => {
    mockApi({ "POST /api/admin/notification-settings/test": { body: { ok: true } } });
    await expect(admin.testNotificationSettings()).resolves.toEqual({ ok: true });
  });
});
