import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "@/test/mockApi";
import * as invites from "./invites";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("invites api", () => {
  it("createHoHInvite posts to /admin/invites", async () => {
    mockApi({
      "POST /api/admin/invites": { body: { invite: { id: "i1" }, emailSent: true } },
    });
    await expect(invites.createHoHInvite("a@example.com")).resolves.toMatchObject({
      emailSent: true,
    });
  });

  it("listHoHInvites gets /admin/invites", async () => {
    mockApi({ "GET /api/admin/invites": { body: { invites: [] } } });
    await expect(invites.listHoHInvites()).resolves.toEqual({ invites: [] });
  });

  it("revokeHoHInvite deletes by id", async () => {
    mockApi({ "DELETE /api/admin/invites/i1": { body: { ok: true } } });
    await expect(invites.revokeHoHInvite("i1")).resolves.toEqual({ ok: true });
  });

  it("createMemberInvite posts to /members/invites", async () => {
    mockApi({
      "POST /api/members/invites": { body: { invite: { id: "i2" }, emailSent: false, emailError: "smtp down" } },
    });
    await expect(invites.createMemberInvite("b@example.com")).resolves.toMatchObject({
      emailError: "smtp down",
    });
  });

  it("listMemberInvites gets /members/invites", async () => {
    mockApi({ "GET /api/members/invites": { body: { invites: [] } } });
    await expect(invites.listMemberInvites()).resolves.toEqual({ invites: [] });
  });

  it("revokeMemberInvite deletes by id", async () => {
    mockApi({ "DELETE /api/members/invites/i2": { body: { ok: true } } });
    await expect(invites.revokeMemberInvite("i2")).resolves.toEqual({ ok: true });
  });

  it("getInvitePreview gets /invites/:token", async () => {
    mockApi({
      "GET /api/invites/tok123": {
        body: { role: "member", email: "b@example.com", status: "pending", expiresAt: "2026-09-01" },
      },
    });
    await expect(invites.getInvitePreview("tok123")).resolves.toMatchObject({ status: "pending" });
  });

  it("acceptInvite posts to /invites/:token/accept", async () => {
    mockApi({
      "POST /api/invites/tok123/accept": {
        body: { household: { id: "h1" }, user: { id: "u2" } },
      },
    });
    await expect(
      invites.acceptInvite("tok123", { name: "Bob", password: "hunter2" }),
    ).resolves.toMatchObject({ user: { id: "u2" } });
  });
});
