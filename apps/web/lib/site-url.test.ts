import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl } from "./site-url";

describe("getSiteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to localhost when unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("strips a trailing slash from the configured URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://studiobook.example.com/");
    expect(getSiteUrl()).toBe("https://studiobook.example.com");
  });

  it("returns the configured URL unchanged when it has no trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://studiobook.example.com");
    expect(getSiteUrl()).toBe("https://studiobook.example.com");
  });
});
