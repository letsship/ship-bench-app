import { type Page, expect, test } from "@playwright/test";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

test.describe("dashboard header", () => {
  test("renders without console or hydration errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await signIn(page);
    await expect(page.getByRole("heading", { name: "Today at the studio" })).toBeVisible();

    const hydrationErrors = errors.filter((e) => /Hydration failed/i.test(e));
    expect(hydrationErrors).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("subtitle matches the expected day-label pattern", async ({ page }) => {
    await signIn(page);
    const subtitle = page.locator("h1", { hasText: "Today at the studio" }).locator("..").locator("p");
    await expect(subtitle).toBeVisible();
    const text = await subtitle.textContent();
    expect(text).toMatch(/^[A-Z][a-z]+ \d{1,2} [A-Z][a-z]+$/);
  });
});
