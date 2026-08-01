import { expect, test } from "@playwright/test";

test.describe("public studio SEO", () => {
  test("renders the public studio page and SEO data without login", async ({ page, request }) => {
    const response = await request.get("/s/riverbank");
    expect(response.status()).toBe(200);

    const html = await response.text();
    expect(html).not.toMatch(/noindex/i);
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('"@type":"Event"');

    await page.goto("/s/riverbank");
    await expect(page.getByRole("heading", { name: "Riverbank Movement" })).toBeVisible();
    await expect(page.getByText("Vinyasa Flow", { exact: true })).toBeVisible();
    await expect(page.getByText("Noor", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Sign in to book a class/i })).toBeVisible();
  });

  test("returns 404 for an unknown studio slug", async ({ request }) => {
    expect((await request.get("/s/not-a-real-studio")).status()).toBe(404);
  });

  test("serves robots and sitemap metadata routes", async ({ request }) => {
    expect((await request.get("/robots.txt")).status()).toBe(200);
    expect((await request.get("/sitemap.xml")).status()).toBe(200);
  });
});
