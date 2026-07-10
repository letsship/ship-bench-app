import { expect, test } from "@playwright/test";

// The public studio page renders with no session at all, so every test here
// overrides the project's storageState with an empty one — same pattern as the
// "unauthenticated" describe block in smoke.spec.ts.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("public studio page", () => {
  test("renders the studio and its upcoming classes with no session", async ({ page }) => {
    await page.goto("/s/riverbank");
    await expect(page.getByRole("heading", { name: "Riverbank Movement" })).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("table").locator("tbody tr").first()).toBeVisible();
  });

  test("is indexable: a studio-specific title and no noindex directive", async ({ page }) => {
    await page.goto("/s/riverbank");
    await expect(page).toHaveTitle(/Riverbank Movement/);
    const robotsMeta = page.locator('meta[name="robots"]');
    if ((await robotsMeta.count()) > 0) {
      await expect(robotsMeta).not.toHaveAttribute("content", /noindex/);
    }
  });

  test("embeds JSON-LD structured data with schema.org Events", async ({ page }) => {
    await page.goto("/s/riverbank");
    const script = page.locator('script[type="application/ld+json"]');
    const raw = await script.textContent();
    const events = JSON.parse(raw ?? "[]");
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event["@type"]).toBe("Event");
      expect(event.name).toBeTruthy();
      expect(event.startDate).toBeTruthy();
      expect(event.location?.name).toBeTruthy();
    }
  });

  test("an unknown slug returns 404", async ({ page }) => {
    const response = await page.goto("/s/does-not-exist");
    expect(response?.status()).toBe(404);
  });

  test("sitemap.xml lists the studio page and robots.txt allows crawling", async ({ request }) => {
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);
    expect(await sitemap.text()).toContain("/s/riverbank");

    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    const robotsBody = await robots.text();
    expect(robotsBody).toContain("Sitemap:");
    expect(robotsBody).not.toContain("Disallow: /s/");
  });
});
