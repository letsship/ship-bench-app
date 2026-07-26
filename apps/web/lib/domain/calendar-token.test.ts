import { describe, expect, it } from "vitest";
import { newCalendarToken } from "./calendar-token";

describe("newCalendarToken", () => {
  it("returns a non-empty, URL-safe, sufficiently long secret", () => {
    const token = newCalendarToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(token).toMatch(/^[a-zA-Z0-9_-]+$/);
  });

  it("generates distinct values across many calls", () => {
    const tokens = new Set(Array.from({ length: 500 }, () => newCalendarToken()));
    expect(tokens.size).toBe(500);
  });
});
