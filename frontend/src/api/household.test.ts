import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "@/test/mockApi";
import * as household from "./household";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("household api", () => {
  it("getHousehold gets /household", async () => {
    mockApi({ "GET /api/household": { body: { id: "h1", name: "Hatfields" } } });
    await expect(household.getHousehold()).resolves.toEqual({ id: "h1", name: "Hatfields" });
  });

  it("updateHousehold patches /household", async () => {
    const fetchMock = mockApi({
      "PATCH /api/household": { body: { id: "h1", name: "New Name" } },
    });
    await household.updateHousehold({ name: "New Name" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/household",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});
