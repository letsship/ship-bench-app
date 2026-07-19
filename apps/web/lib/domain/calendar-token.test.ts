import { describe, it, expect } from "vitest";
import { generateCalendarToken } from "./calendar-token";

describe("generateCalendarToken", () => {
  it("returns a non-empty string", () => {
    const token = generateCalendarToken();
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
  });

  it("returns a URL-safe hex string", () => {
    const token = generateCalendarToken();
    expect(/^[0-9a-f]+$/.test(token)).toBe(true);
  });

  it("generates unique tokens on successive calls", () => {
    const token1 = generateCalendarToken();
    const token2 = generateCalendarToken();
    expect(token1).not.toBe(token2);
  });

  it("generates tokens of consistent length", () => {
    const token1 = generateCalendarToken();
    const token2 = generateCalendarToken();
    // 32 bytes = 64 hex characters
    expect(token1.length).toBe(64);
    expect(token2.length).toBe(64);
  });
});
