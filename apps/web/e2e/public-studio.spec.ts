import { expect, test } from "@playwright/test";

test("the public studio page renders unauthenticated, with no redirect to login", async ({
  page,
}) => {
  await page.goto("/s/riverbank");
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Riverbank Movement" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming classes" })).toBeVisible();
});

test("an unknown slug 404s", async ({ page }) => {
  const response = await page.goto("/s/does-not-exist");
  expect(response?.status()).toBe(404);
});

test("sitemap.xml lists the public studio page", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("/s/riverbank");
});

test("robots.txt allows crawling and references the sitemap", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("Allow: /");
  expect(body).toContain("Sitemap:");
  expect(body).toContain("/sitemap.xml");
});

test("the page embeds valid schema.org Event JSON-LD", async ({ page }) => {
  await page.goto("/s/riverbank");
  const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
  expect(jsonLd).toBeTruthy();
  const parsed = JSON.parse(jsonLd ?? "[]");
  expect(Array.isArray(parsed)).toBe(true);
  expect(parsed.length).toBeGreaterThan(0);
  expect(parsed[0]["@type"]).toBe("Event");
  expect(parsed[0].name).toBeTruthy();
  expect(parsed[0].startDate).toBeTruthy();
  expect(parsed[0].location).toBeTruthy();
});
