import { expect, test } from "@playwright/test";

// The public studio page and its supporting SEO routes are all unauthenticated
// — override the project's storageState so these run signed out, same as
// smoke.spec.ts's "unauthenticated" describe block.
test.describe("unauthenticated", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the public studio page renders the studio and its upcoming classes without a login redirect", async ({
    page,
  }) => {
    await page.goto("/s/riverbank");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText("Riverbank Movement", { exact: true })).toBeVisible();
    await expect(page.getByText("Upcoming classes")).toBeVisible();
    await expect(page.getByText(/with .+/).first()).toBeVisible();
  });

  test("has a title naming the studio, an indexable meta description, and JSON-LD structured data", async ({
    page,
  }) => {
    await page.goto("/s/riverbank");
    await expect(page).toHaveTitle(/Riverbank Movement/);

    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute("content", /Riverbank Movement/);

    const robots = page.locator('meta[name="robots"]');
    await expect(robots).not.toHaveAttribute("content", /noindex/);

    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    const events = JSON.parse(jsonLd ?? "[]");
    expect(Array.isArray(events)).toBe(true);
    expect(events[0]).toMatchObject({ "@type": "Event" });
    expect(events[0].name).toBeTruthy();
    expect(events[0].startDate).toBeTruthy();
    expect(events[0].location).toBeTruthy();
  });

  test("the studio image has descriptive alt text and the CTA link has descriptive copy", async ({
    page,
  }) => {
    await page.goto("/s/riverbank");
    const image = page.locator("img").first();
    await expect(image).toHaveAttribute("alt", /Riverbank Movement/);

    const cta = page.getByRole("link", { name: /Book a class at Riverbank Movement/i });
    await expect(cta).toBeVisible();
    await expect(page.getByRole("link", { name: "Click here" })).toHaveCount(0);
  });

  test("an unknown slug 404s", async ({ page }) => {
    const response = await page.goto("/s/does-not-exist");
    expect(response?.status()).toBe(404);
  });

  test("GET /sitemap.xml lists the public studio page", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");
    const body = await response.text();
    expect(body).toContain("/s/riverbank");
  });

  test("GET /robots.txt allows crawling and references the sitemap", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("Allow: /s/");
    expect(body).toContain("Sitemap:");
    expect(body).toMatch(/Sitemap:.*\/sitemap\.xml/);
  });
});
