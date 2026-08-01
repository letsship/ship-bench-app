import { describe, expect, it } from "vitest";
import { newCalendarToken } from "./ids";

describe("newCalendarToken", () => {
  it("returns a long URL-safe secret", () => {
    const token = newCalendarToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(32);
  });

  it("returns distinct values", () => {
    expect(newCalendarToken()).not.toBe(newCalendarToken());
  });
});
