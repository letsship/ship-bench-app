import { describe, expect, it } from "vitest";
import { isSupportedClientVersion } from "./version";

describe("isSupportedClientVersion", () => {
  it("accepts a version at or above the minimum", () => {
    expect(isSupportedClientVersion("1.4.0")).toBe(true);
    expect(isSupportedClientVersion("2.0.1")).toBe(true);
  });

  it("rejects an older or malformed version", () => {
    expect(isSupportedClientVersion("1.3.9")).toBe(false);
    expect(isSupportedClientVersion("not-a-version")).toBe(false);
  });
});
