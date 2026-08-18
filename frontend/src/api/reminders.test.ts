import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "@/test/mockApi";
import * as reminders from "./reminders";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reminders api", () => {
  it("listReminders gets /reminders", async () => {
    mockApi({ "GET /api/reminders": { body: { reminders: [] } } });
    await expect(reminders.listReminders()).resolves.toEqual({ reminders: [] });
  });

  it("createReminder posts input", async () => {
    mockApi({ "POST /api/reminders": { body: { id: "r1", title: "Take out trash" } } });
    await expect(reminders.createReminder({ title: "Take out trash" })).resolves.toMatchObject({
      id: "r1",
    });
  });

  it("toggleReminderDone patches /reminders/:id/toggle", async () => {
    mockApi({ "PATCH /api/reminders/r1/toggle": { body: { id: "r1", done: true } } });
    await expect(reminders.toggleReminderDone("r1")).resolves.toMatchObject({ done: true });
  });

  it("deleteReminder deletes by id", async () => {
    mockApi({ "DELETE /api/reminders/r1": { body: { ok: true } } });
    await expect(reminders.deleteReminder("r1")).resolves.toEqual({ ok: true });
  });
});
