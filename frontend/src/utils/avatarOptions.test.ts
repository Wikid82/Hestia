import { describe, expect, it } from "vitest";
import { AVATAR_OPTIONS } from "./avatarOptions";

describe("AVATAR_OPTIONS", () => {
  it("is a non-empty list of unique emoji strings", () => {
    expect(AVATAR_OPTIONS.length).toBeGreaterThan(0);
    expect(new Set(AVATAR_OPTIONS).size).toBe(AVATAR_OPTIONS.length);
    for (const emoji of AVATAR_OPTIONS) {
      expect(typeof emoji).toBe("string");
      expect(emoji.length).toBeGreaterThan(0);
    }
  });
});
