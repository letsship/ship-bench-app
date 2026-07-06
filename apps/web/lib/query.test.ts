import { describe, expect, it } from "vitest";
import { rawSearchParam } from "./query";

describe("rawSearchParam", () => {
  it("decodes a percent-encoded plus into a literal +00:00 offset", () => {
    const search = "?to=2026-06-30T00:00:00%2B00:00";
    expect(rawSearchParam(search, "to")).toBe("2026-06-30T00:00:00+00:00");
  });

  it("leaves a literal + untouched, unlike URLSearchParams", () => {
    const search = "?to=2026-06-30T00:00:00+00:00";
    expect(rawSearchParam(search, "to")).toBe("2026-06-30T00:00:00+00:00");
    // Documents the exact bug this helper works around.
    expect(new URLSearchParams(search).get("to")).toBe("2026-06-30T00:00:00 00:00");
  });

  it("returns undefined when the param is absent", () => {
    expect(rawSearchParam("?from=2026-06-01T00:00:00Z", "to")).toBeUndefined();
  });

  it("reads the requested param when several are present", () => {
    const search = "?from=2026-06-01T00:00:00Z&to=2026-06-30T00:00:00%2B00:00";
    expect(rawSearchParam(search, "from")).toBe("2026-06-01T00:00:00Z");
    expect(rawSearchParam(search, "to")).toBe("2026-06-30T00:00:00+00:00");
  });
});
