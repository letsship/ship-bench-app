import { expect, test } from "@playwright/test";

test("the public studio page renders without signing in", async ({ page }) => {
  await page.goto("/s/riverbank");
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Riverbank Movement" })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();

  const jsonLd = page.locator('script[type="application/ld+json"]');
  await expect(jsonLd).toHaveCount(1);
  const payload = JSON.parse((await jsonLd.textContent()) ?? "[]");
  expect(Array.isArray(payload)).toBe(true);
  expect(payload[0]).toMatchObject({ "@type": "Event" });
});

test("an unknown studio slug 404s", async ({ page }) => {
  const response = await page.goto("/s/does-not-exist");
  expect(response?.status()).toBe(404);
});
