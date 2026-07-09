import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "./robots";

describe("robots", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows crawling of / and points at the absolute sitemap URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://studiobook.example.com");

    const result = robots();

    expect(result.rules).toMatchObject({ userAgent: "*", allow: "/" });
    expect(result.sitemap).toBe("https://studiobook.example.com/sitemap.xml");
  });
});
