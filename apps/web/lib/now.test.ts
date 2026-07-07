import { describe, expect, it } from "vitest";
import { getNow } from "./now";

describe("getNow", () => {
  it("returns a parseable ISO-8601 UTC timestamp", () => {
    const iso = getNow();
    const parsed = new Date(iso);
    expect(Number.isNaN(parsed.getTime())).toBe(false);
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("returns the same value when called multiple times in the same render", () => {
    const a = getNow();
    const b = getNow();
    expect(a).toBe(b);
  });
});