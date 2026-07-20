import { describe, it, expect } from "vitest";
import { newCalendarToken } from "./ids";

describe("newCalendarToken", () => {
  it("generates a 64-character hex string", () => {
    const token = newCalendarToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("generates unique tokens", () => {
    const tokens = new Set();
    for (let i = 0; i < 100; i++) {
      tokens.add(newCalendarToken());
    }
    expect(tokens.size).toBe(100);
  });
});
