import { api } from "./client";
import type { NotificationProvider, NotificationSettings } from "@/types";

export function getNotificationSettings() {
  return api.get<NotificationSettings>("/admin/notification-settings");
}

export function updateNotificationSettings(input: {
  provider: NotificationProvider;
  config: Record<string, string>;
}) {
  return api.put<NotificationSettings>("/admin/notification-settings", input);
}

export function testNotificationSettings() {
  return api.post<{ ok: true }>("/admin/notification-settings/test");
}
