import { expect, test } from "@playwright/test";

// Public studio page tests: these run without authentication, so they override
// the project's storageState with an empty session. This validates that the
// public studio page is accessible to anyone and is properly indexed for search.
test.describe("public studio page", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("renders the studio page with name and upcoming classes", async ({ page }) => {
    await page.goto("/s/riverbank");
    await expect(page).not.toHaveURL(/\/login/);

    // The page shows the studio name
    await expect(
      page.locator("div").filter({ hasText: "Riverbank Movement" }).first(),
    ).toBeVisible();

    // At least one upcoming class is visible
    const classes = page.locator("div").filter({ hasText: /with \w+/ });
    await expect(classes.first()).toBeVisible();
  });

  test("has proper SEO metadata in HTML head", async ({ page }) => {
    const response = await page.goto("/s/riverbank");
    expect(response?.status()).toBe(200);

    // Gather all relevant meta tags
    const html = await page.content();

    // Verify title is not just "Studio" but contains the studio name
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    expect(titleMatch?.[1]).toContain("Riverbank");
    expect(titleMatch?.[1]).not.toBe("Studio");

    // Verify description meta tag exists
    const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"[^>]*>/);
    expect(descMatch?.[1]).toBeDefined();
    expect(descMatch?.[1]).toContain("Riverbank");

    // Verify no noindex directive
    expect(html).not.toContain('robots" content="noindex');
    expect(html).not.toContain('robots" content="nofollow');

    // Verify Open Graph tags exist
    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"[^>]*>/);
    expect(ogTitle?.[1]).toBeDefined();

    const ogDescription = html.match(
      /<meta[^>]*property="og:description"[^>]*content="([^"]*)"[^>]*>/,
    );
    expect(ogDescription?.[1]).toBeDefined();

    const ogType = html.match(/<meta[^>]*property="og:type"[^>]*content="([^"]*)"[^>]*>/);
    expect(ogType?.[1]).toBe("website");

    // Verify Twitter card tags exist
    const twitterCard = html.match(/<meta[^>]*name="twitter:card"[^>]*content="([^"]*)"[^>]*>/);
    expect(twitterCard?.[1]).toBe("summary_large_image");

    // Verify canonical link exists
    const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"[^>]*>/);
    expect(canonical?.[1]).toContain("/s/riverbank");
  });

  test("includes JSON-LD structured data for events", async ({ page }) => {
    const response = await page.goto("/s/riverbank");
    expect(response?.status()).toBe(200);

    const html = await page.content();

    // Find JSON-LD script tag
    const jsonLdMatch = html.match(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/,
    );
    expect(jsonLdMatch).toBeDefined();

    const jsonLd = JSON.parse(jsonLdMatch![1]);
    expect(Array.isArray(jsonLd)).toBe(true);

    if (jsonLd.length > 0) {
      // Verify Event structure
      const event = jsonLd[0];
      expect(event["@context"]).toBe("https://schema.org");
      expect(event["@type"]).toBe("Event");
      expect(event.name).toBeDefined();
      expect(event.startDate).toBeDefined();
      expect(event.location).toBeDefined();
      expect(event.location["@type"]).toBe("Place");
      expect(event.location.name).toBeDefined();
    }
  });

  test("has descriptive alt text on images", async ({ page }) => {
    await page.goto("/s/riverbank");

    // Verify image has descriptive alt text (not empty, and mentions studio)
    const img = page.locator("img[alt*='studio']").first();
    const altText = await img.getAttribute("alt");
    expect(altText).toBeTruthy();
    expect(altText).toContain("studio");
  });

  test("has descriptive link text, not 'Click here'", async ({ page }) => {
    await page.goto("/s/riverbank");

    // Verify no "Click here" links
    const clickHereLinks = await page.locator('a:has-text("Click here")').count();
    expect(clickHereLinks).toBe(0);

    // Verify a link exists with descriptive text
    const studioLink = page.locator('a:has-text("Book")');
    await expect(studioLink).toBeVisible();
  });

  test("returns 404 for unknown studio slug", async ({ page }) => {
    const response = await page.goto("/s/nonexistent-studio-xyz");
    expect(response?.status()).toBe(404);
  });

  test("robots.txt allows crawling and references sitemap", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.ok()).toBe(true);

    const text = await response.text();
    expect(text.toLowerCase()).toContain("user-agent:");
    expect(text).toContain("Allow: /");
    expect(text).toContain("Sitemap:");
    expect(text).toContain("/sitemap.xml");
  });

  test("sitemap.xml lists the public studio page", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.ok()).toBe(true);

    const contentType = response.headers()["content-type"] || "";
    expect(contentType).toContain("xml");

    const text = await response.text();
    expect(text).toContain("<urlset");
    expect(text).toContain("/s/riverbank");
  });

  test("renders without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/s/riverbank");
    await expect(
      page.locator("div").filter({ hasText: "Riverbank Movement" }).first(),
    ).toBeVisible();

    expect(errors).toEqual([]);
  });
});
