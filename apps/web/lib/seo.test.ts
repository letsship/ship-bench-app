import { describe, it, expect, afterEach } from "vitest";
import { siteUrl, SITE_NAME, SITE_DESCRIPTION } from "./seo";

describe("seo", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = originalEnv;
  });

  describe("siteUrl", () => {
    it("uses the env value when set", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
      expect(siteUrl()).toBe("https://example.com");
    });

    it("strips a trailing slash", () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://example.com/";
      expect(siteUrl()).toBe("https://example.com");
    });

    it("falls back to the default when NEXT_PUBLIC_SITE_URL is unset", () => {
      delete process.env.NEXT_PUBLIC_SITE_URL;
      expect(siteUrl()).toBe("https://studiobook.app");
    });
  });

  describe("constants", () => {
    it("SITE_NAME is non-empty", () => {
      expect(SITE_NAME).toBeTruthy();
    });

    it("SITE_DESCRIPTION is non-empty", () => {
      expect(SITE_DESCRIPTION).toBeTruthy();
    });
  });
});
