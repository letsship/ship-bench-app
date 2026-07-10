import { expect, test } from "@playwright/test";

// Pre-auth flow: the public studio page must render for a signed-out visitor.
test.describe("public studio page", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("shows the studio and its upcoming classes without a login redirect", async ({ page }) => {
    await page.goto("/s/riverbank");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Riverbank Movement" })).toBeVisible();
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible();
  });

  test("has studio-specific title and meta description", async ({ page }) => {
    await page.goto("/s/riverbank");
    await expect(page).toHaveTitle(/Riverbank Movement/);
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveCount(1);
    expect(await description.getAttribute("content")).not.toBe("");
  });

  test("embeds valid JSON-LD Event structured data", async ({ page }) => {
    await page.goto("/s/riverbank");
    const script = page.locator('script[type="application/ld+json"]');
    await expect(script).toHaveCount(1);
    const raw = await script.textContent();
    const parsed = JSON.parse(raw ?? "[]");
    const events = Array.isArray(parsed) ? parsed : [parsed];
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(event["@type"]).toBe("Event");
      expect(event.name).toBeTruthy();
      expect(event.startDate).toBeTruthy();
      expect(event.location).toBeTruthy();
    }
  });

  test("has a descriptive image alt and CTA link text", async ({ page }) => {
    await page.goto("/s/riverbank");
    const image = page.locator("img").first();
    const alt = await image.getAttribute("alt");
    expect(alt).toBeTruthy();
    expect(alt?.toLowerCase()).not.toBe("image");

    const cta = page.getByRole("link", { name: /Riverbank Movement/i });
    await expect(cta).toBeVisible();
    expect((await cta.textContent())?.toLowerCase()).not.toContain("click here");
  });

  test("an unknown slug returns 404", async ({ page }) => {
    const response = await page.goto("/s/does-not-exist");
    expect(response?.status()).toBe(404);
  });

  test("sitemap.xml and robots.txt are served", async ({ request }) => {
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.ok()).toBe(true);

    const robots = await request.get("/robots.txt");
    expect(robots.ok()).toBe(true);
    expect(await robots.text()).toContain("sitemap.xml");
  });
});
