import { expect, test } from "@playwright/test";

test.describe("Tailwind v4 migration — style guards", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("body background-color is parchment (rgb(246, 241, 231))", async ({ page }) => {
    await page.goto("/");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(246, 241, 231)");
  });

  test("footer text-[var(--color-muted)] computes to rgb(133, 122, 102)", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    const color = await footer.evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe("rgb(133, 122, 102)");
  });
});