import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "@/test/mockApi";
import * as auth from "./auth";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("auth api", () => {
  it("signup posts to /auth/signup", async () => {
    const fetchMock = mockApi({
      "POST /api/auth/signup": {
        body: { household: { id: "h1" }, user: { id: "u1" } },
      },
    });
    const result = await auth.signup({
      householdName: "Hatfields",
      name: "Jeremy",
      email: "j@example.com",
      password: "hunter2",
    });
    expect(result.user).toEqual({ id: "u1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/signup",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("login posts to /auth/login", async () => {
    mockApi({ "POST /api/auth/login": { body: { user: { id: "u1" } } } });
    const result = await auth.login({ email: "j@example.com", password: "hunter2" });
    expect(result.user).toEqual({ id: "u1" });
  });

  it("logout posts to /auth/logout", async () => {
    mockApi({ "POST /api/auth/logout": { body: { ok: true } } });
    await expect(auth.logout()).resolves.toEqual({ ok: true });
  });

  it("me gets /auth/me", async () => {
    mockApi({ "GET /api/auth/me": { body: { household: null, user: null } } });
    await expect(auth.me()).resolves.toEqual({ household: null, user: null });
  });
});
