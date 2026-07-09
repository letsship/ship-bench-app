import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const existsSyncMock = vi.hoisted(() => vi.fn());
vi.mock("node:fs", () => ({
  existsSync: (...args: unknown[]) => existsSyncMock(...args),
}));

// robots.ts reads process.env directly (not lib/env's clientEnv()), so each
// test re-imports it fresh after stubbing NEXT_PUBLIC_SITE_URL.
async function loadRobots() {
  vi.resetModules();
  const mod = await import("./robots");
  return mod.default;
}

describe("robots", () => {
  beforeEach(() => {
    existsSyncMock.mockReset();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows all crawlers on public content", async () => {
    existsSyncMock.mockReturnValue(false);
    const robots = await loadRobots();
    const result = robots();
    expect(result.rules).toMatchObject({
      userAgent: "*",
      allow: expect.arrayContaining(["/"]),
    });
  });

  it("disallows the API and the authenticated app routes", async () => {
    existsSyncMock.mockReturnValue(false);
    const robots = await loadRobots();
    const result = robots();
    expect(result.rules).toMatchObject({
      disallow: expect.arrayContaining([
        "/api/",
        "/dashboard",
        "/bookings",
        "/invoices",
        "/members",
        "/classes",
        "/reports",
        "/settings",
      ]),
    });
  });

  it("includes the sitemap when the route exists and the site URL is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://studiobook.example.com");
    existsSyncMock.mockReturnValue(true);
    const robots = await loadRobots();
    const result = robots();
    expect(result.sitemap).toBe("https://studiobook.example.com/sitemap.xml");
  });

  it("omits the sitemap when no sitemap route exists", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://studiobook.example.com");
    existsSyncMock.mockReturnValue(false);
    const robots = await loadRobots();
    const result = robots();
    expect(result.sitemap).toBeUndefined();
  });

  it("omits the sitemap when the site URL is not configured", async () => {
    existsSyncMock.mockReturnValue(true);
    const robots = await loadRobots();
    const result = robots();
    expect(result.sitemap).toBeUndefined();
  });
});
