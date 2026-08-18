import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "@/test/mockApi";
import * as profiles from "./profiles";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("profiles api", () => {
  it("listProfiles gets /profiles", async () => {
    mockApi({ "GET /api/profiles": { body: { profiles: [] } } });
    await expect(profiles.listProfiles()).resolves.toEqual({ profiles: [] });
  });

  it("switchProfile posts with pin", async () => {
    const fetchMock = mockApi({
      "POST /api/profiles/u1/switch": { body: { user: { id: "u1" } } },
    });
    await profiles.switchProfile("u1", "1234");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/profiles/u1/switch",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ pin: "1234" }) }),
    );
  });

  it("switchProfile defaults pin to empty string", async () => {
    const fetchMock = mockApi({
      "POST /api/profiles/u1/switch": { body: { user: { id: "u1" } } },
    });
    await profiles.switchProfile("u1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/profiles/u1/switch",
      expect.objectContaining({ body: JSON.stringify({ pin: "" }) }),
    );
  });

  it("switchToPicker posts /profiles/to-picker", async () => {
    mockApi({ "POST /api/profiles/to-picker": { body: { ok: true } } });
    await expect(profiles.switchToPicker()).resolves.toEqual({ ok: true });
  });
});
