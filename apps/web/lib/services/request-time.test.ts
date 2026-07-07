import { describe, expect, it } from "vitest";
import { getRequestNowIso } from "./request-time";

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

describe("getRequestNowIso", () => {
  it("returns a valid UTC ISO timestamp", () => {
    const iso = getRequestNowIso();
    expect(iso).toMatch(ISO_PATTERN);
    expect(new Date(iso).toISOString()).toBe(iso);
  });

  it("returns the identical memoized value across repeated calls in one pass", () => {
    const first = getRequestNowIso();
    const second = getRequestNowIso();
    const third = getRequestNowIso();
    expect(second).toBe(first);
    expect(third).toBe(first);
  });
});
