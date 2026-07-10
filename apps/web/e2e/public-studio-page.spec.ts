import { expect, test } from "@playwright/test";
import { resetBackend } from "./support/auth";

// The public studio page is unauthenticated by design — search engines and
// prospective members hit it without ever signing in.
test.describe("public studio page", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ request }) => {
    await resetBackend(request);
  });

  test("renders the studio and its upcoming classes without redirecting to login", async ({
    page,
  }) => {
    await page.goto("/s/riverbank");
    await expect(page).toHaveURL(/\/s\/riverbank$/);
    await expect(page.getByRole("heading", { name: "Riverbank Movement" })).toBeVisible();
    await expect(page.getByTestId("upcoming-classes")).toBeVisible();
    await expect(page.getByRole("link", { name: /Sign in to book a class/i })).toBeVisible();
  });

  test("has studio-specific SEO metadata and JSON-LD event data", async ({ page }) => {
    await page.goto("/s/riverbank");
    await expect(page).toHaveTitle(/Riverbank Movement/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /Riverbank Movement/,
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      /Riverbank Movement/,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/s\/riverbank$/);

    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    const events = JSON.parse(jsonLd ?? "[]");
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event["@type"]).toBe("Event");
      expect(event.name).toBeTruthy();
      expect(event.startDate).toBeTruthy();
      expect(event.location).toBeTruthy();
    }
  });

  test("an unknown slug returns 404", async ({ page }) => {
    const response = await page.goto("/s/does-not-exist");
    expect(response?.status()).toBe(404);
  });

  test("sitemap.xml and robots.txt are served and reference each other", async ({ request }) => {
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    expect(sitemap.headers()["content-type"]).toContain("xml");
    expect(await sitemap.text()).toContain("/s/riverbank");

    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    expect(robots.headers()["content-type"]).toContain("text/plain");
    const robotsBody = await robots.text();
    expect(robotsBody).toContain("Sitemap:");
    expect(robotsBody).toContain("/sitemap.xml");
  });
});
