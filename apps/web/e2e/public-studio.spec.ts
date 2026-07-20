import { expect, test } from "@playwright/test";

// Pre-auth flows: these start signed OUT, so they override the project's
// storageState with an empty session.
test.describe("public studio page (unauthenticated)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("renders without login at /s/[slug]", async ({ page }) => {
    await page.goto("/s/riverbank");
    await expect(page).toHaveURL("/s/riverbank");
    await expect(page.getByText(/Riverbank/i)).toBeVisible();
  });

  test("displays studio name and upcoming classes", async ({ page }) => {
    await page.goto("/s/riverbank");
    await expect(page.getByText(/Riverbank/i)).toBeVisible();
    await expect(page.getByText(/Upcoming classes/i)).toBeVisible();
    // At least one class should be visible from the seeded data
    await expect(page.locator("div").filter({ hasText: /with/ })).toBeVisible();
  });

  test("has proper SEO metadata", async ({ page }) => {
    await page.goto("/s/riverbank");

    // Check title includes studio name
    const title = await page.title();
    expect(title).toContain("Riverbank");

    // Check meta description
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description).toContain("Riverbank");

    // Check OpenGraph tags
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
    expect(ogTitle).toContain("Riverbank");

    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute("content");
    expect(ogUrl).toContain("/s/riverbank");

    const ogType = await page.locator('meta[property="og:type"]').getAttribute("content");
    expect(ogType).toBe("website");

    // Check Twitter card tags
    const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute("content");
    expect(twitterCard).toBe("summary_large_image");

    const twitterTitle = await page.locator('meta[name="twitter:title"]').getAttribute("content");
    expect(twitterTitle).toContain("Riverbank");

    // Check canonical URL
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toContain("/s/riverbank");
  });

  test("does not have noindex directive", async ({ page }) => {
    await page.goto("/s/riverbank");

    // Check that robots meta tag does not have noindex
    const robotsMeta = await page.locator('meta[name="robots"]').getAttribute("content");
    if (robotsMeta) {
      expect(robotsMeta).not.toContain("noindex");
    }
  });

  test("includes JSON-LD structured data", async ({ page }) => {
    await page.goto("/s/riverbank");

    const jsonLdScript = await page.locator('script[type="application/ld+json"]').textContent();
    expect(jsonLdScript).toBeTruthy();

    const jsonLd = JSON.parse(jsonLdScript || "[]");
    expect(Array.isArray(jsonLd)).toBe(true);
    expect(jsonLd.length).toBeGreaterThan(0);

    // Each event should have required fields
    jsonLd.forEach((event: Record<string, unknown>) => {
      expect(event["@type"]).toBe("Event");
      expect(event["@context"]).toBe("https://schema.org");
      expect(event.name).toBeTruthy();
      expect(event.startDate).toBeTruthy();
      expect(event.location).toBeTruthy();
    });
  });

  test("has descriptive image alt text", async ({ page }) => {
    await page.goto("/s/riverbank");

    const img = await page.locator("img").first();
    const altText = await img.getAttribute("alt");
    expect(altText).toBeTruthy();
    expect(altText).toContain("Riverbank");
    expect(altText).not.toBe("");
  });

  test("has descriptive call-to-action text", async ({ page }) => {
    await page.goto("/s/riverbank");

    const cta = await page.locator("a").filter({ hasText: /Book/ }).textContent();
    expect(cta).toContain("Book a class at");
    expect(cta).not.toContain("Click here");
  });

  test("returns 404 for unknown studio slug", async ({ _page, context }) => {
    const response = await context.request.get("/s/unknown-studio-that-does-not-exist");
    expect(response.status()).toBe(404);
  });

  test("/robots.txt allows crawling and references sitemap", async ({ context }) => {
    const response = await context.request.get("/robots.txt");
    expect(response.ok()).toBe(true);

    const text = await response.text();
    expect(text).toContain("User-agent: *");
    expect(text).toContain("Allow: /");
    expect(text).toContain("Sitemap:");
    expect(text).toContain("/sitemap.xml");
  });

  test("/sitemap.xml lists public studio pages", async ({ context }) => {
    const response = await context.request.get("/sitemap.xml");
    expect(response.ok()).toBe(true);

    const text = await response.text();
    expect(text).toContain("<urlset");
    expect(text).toContain("/s/riverbank");
    expect(text).toContain("<loc>");
  });
});
