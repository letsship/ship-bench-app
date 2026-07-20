import { expect, test } from "@playwright/test";

// Public studio page tests — unauthenticated access, no auth redirect required
test.describe("public studio page", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("loads /s/riverbank without requiring authentication", async ({ page }) => {
    const response = await page.goto("/s/riverbank");
    expect(response?.status()).toBe(200);

    // Verify we're on the page, not redirected to login
    expect(page.url()).toContain("/s/riverbank");
  });

  test("has a page title naming the studio, not generic 'Studio'", async ({ page }) => {
    await page.goto("/s/riverbank");

    const title = await page.title();
    expect(title).toContain("Riverbank");
    expect(title).not.toBe("Studio");
  });

  test("has a meta description naming the studio", async ({ page }) => {
    await page.goto("/s/riverbank");

    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description).toContain("Riverbank");
  });

  test("is indexable (no noindex robots directive)", async ({ page }) => {
    await page.goto("/s/riverbank");

    // Check for absence of noindex in the HTML
    const html = await page.content();
    expect(html).not.toContain("noindex");

    // Verify robots meta allows indexing
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    if (robots) {
      expect(robots).not.toContain("noindex");
    }
  });

  test("includes Open Graph tags for social preview", async ({ page }) => {
    await page.goto("/s/riverbank");

    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
    expect(ogTitle).toContain("Riverbank");

    const ogDescription = await page
      .locator('meta[property="og:description"]')
      .getAttribute("content");
    expect(ogDescription).toBeDefined();

    const ogType = await page.locator('meta[property="og:type"]').getAttribute("content");
    expect(ogType).toBe("website");
  });

  test("includes Twitter card tags", async ({ page }) => {
    await page.goto("/s/riverbank");

    const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute("content");
    expect(twitterCard).toBe("summary_large_image");

    const twitterTitle = await page.locator('meta[name="twitter:title"]').getAttribute("content");
    expect(twitterTitle).toContain("Riverbank");
  });

  test("includes canonical URL", async ({ page }) => {
    await page.goto("/s/riverbank");

    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toContain("/s/riverbank");
  });

  test("embeds schema.org Event structured data in JSON-LD", async ({ page }) => {
    await page.goto("/s/riverbank");

    // Extract and parse the JSON-LD script
    const scriptContent = await page
      .locator('script[type="application/ld+json"]')
      .first()
      .textContent();

    expect(scriptContent).toBeDefined();
    const events = JSON.parse(scriptContent || "[]");

    // Should be an array of events
    expect(Array.isArray(events)).toBe(true);

    // If events exist, each should have required fields
    if (events.length > 0) {
      events.forEach((event: Record<string, unknown>) => {
        expect(event["@context"]).toBe("https://schema.org");
        expect(event["@type"]).toBe("Event");
        expect(event.name).toBeDefined();
        expect(event.startDate).toBeDefined();
        expect(event.endDate).toBeDefined();
        expect(event.location).toBeDefined();
        expect(event.location.name).toBe("Riverbank Movement");
      });
    }
  });

  test("renders studio name and upcoming classes", async ({ page }) => {
    await page.goto("/s/riverbank");

    // Studio name should be visible
    expect(await page.getByText("Riverbank Movement")).toBeVisible();

    // Upcoming classes section should be visible
    expect(await page.getByText("Upcoming classes")).toBeVisible();

    // At least one class with name and instructor
    const hasClassContent = await page.getByText(/with /).isVisible();
    expect(hasClassContent).toBe(true);
  });

  test("has descriptive alt text for studio image", async ({ page }) => {
    await page.goto("/s/riverbank");

    const img = page.locator("img").first();
    const alt = await img.getAttribute("alt");
    expect(alt).toContain("Riverbank");
    expect(alt).toContain("studio");
  });

  test("has descriptive call-to-action link text, not 'Click here'", async ({ page }) => {
    await page.goto("/s/riverbank");

    const link = page.locator("a[href='/login']");
    const text = await link.textContent();
    expect(text).toContain("Book a class");
    expect(text).toContain("Riverbank");
    expect(text).not.toBe("Click here");
  });

  test("returns 404 for unknown studio slug", async ({ page }) => {
    const response = await page.goto("/s/does-not-exist");
    expect(response?.status()).toBe(404);
  });

  test("/robots.txt is accessible and allows crawling", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);

    const content = await response.text();
    expect(content).toContain("User-agent: *");
    expect(content).toContain("Allow: /");
    expect(content).toContain("Sitemap:");
  });

  test("/sitemap.xml is accessible and lists public studio pages", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);

    const content = await response.text();
    expect(content).toContain("/s/riverbank");
    expect(content).toContain("<?xml");
  });
});
