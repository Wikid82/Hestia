import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "@/test/mockApi";
import * as members from "./members";

afterEach(() => {
  vi.unstubAllGlobals();
});

const memberInput: members.MemberInput = {
  name: "Kid",
  role: "member",
  avatarEmoji: "🦊",
};

describe("members api", () => {
  it("listMembers gets /members", async () => {
    mockApi({ "GET /api/members": { body: { members: [] } } });
    await expect(members.listMembers()).resolves.toEqual({ members: [] });
  });

  it("getMember gets by id", async () => {
    mockApi({ "GET /api/members/m1": { body: { id: "m1" } } });
    await expect(members.getMember("m1")).resolves.toEqual({ id: "m1" });
  });

  it("createMember posts input", async () => {
    mockApi({ "POST /api/members": { body: { id: "m1", ...memberInput } } });
    await expect(members.createMember(memberInput)).resolves.toMatchObject({ id: "m1" });
  });

  it("updateMember patches by id", async () => {
    mockApi({ "PATCH /api/members/m1": { body: { id: "m1", ...memberInput } } });
    await expect(members.updateMember("m1", memberInput)).resolves.toMatchObject({ id: "m1" });
  });

  it("setOwnCredentials patches /members/me/credentials", async () => {
    mockApi({ "PATCH /api/members/me/credentials": { body: { id: "m1" } } });
    await expect(
      members.setOwnCredentials({ email: "a@example.com", password: "hunter2" }),
    ).resolves.toEqual({ id: "m1" });
  });

  it("setMemberCredentials patches /members/:id/credentials", async () => {
    mockApi({ "PATCH /api/members/m1/credentials": { body: { id: "m1" } } });
    await expect(
      members.setMemberCredentials("m1", { email: "a@example.com", password: "hunter2" }),
    ).resolves.toEqual({ id: "m1" });
  });

  it("clearMemberPin deletes /members/:id/pin", async () => {
    mockApi({ "DELETE /api/members/m1/pin": { body: { ok: true } } });
    await expect(members.clearMemberPin("m1")).resolves.toEqual({ ok: true });
  });

  it("deleteMember deletes by id", async () => {
    mockApi({ "DELETE /api/members/m1": { body: { ok: true } } });
    await expect(members.deleteMember("m1")).resolves.toEqual({ ok: true });
  });
});
