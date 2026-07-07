import { type Page, expect, test } from "@playwright/test";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

test.describe("invoice line-item XSS prevention", () => {
  test("a line-item description containing HTML markup is rendered as inert escaped text", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await signIn(page);
    await page.goto("/invoices");

    const description = '<img src=x onerror="window.__xssFired = true">';

    await page.getByPlaceholder("Description").fill(description);
    await page.getByLabel("Quantity").fill("1");
    await page.getByLabel("Unit price").fill("10");
    await page.getByRole("button", { name: "Issue invoice" }).click();

    await expect(page.getByPlaceholder("Description")).toHaveValue("");

    await page.getByTestId("invoices-table").locator("tbody tr a").last().click();
    await page.waitForURL("**/invoices/[^/]+$");

    await expect(page.getByText(description, { exact: true })).toBeVisible();

    await expect(page.locator('img[src="x"]')).toHaveCount(0);

    const xssFired = await page.evaluate(() => (window as Record<string, unknown>).__xssFired);
    expect(xssFired).toBeUndefined();

    expect(errors).toEqual([]);
  });

  test("an ordinary plain-text description renders as normal readable text", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await signIn(page);
    await page.goto("/invoices");

    const description = "Monthly membership — all access";

    await page.getByPlaceholder("Description").fill(description);
    await page.getByLabel("Quantity").fill("1");
    await page.getByLabel("Unit price").fill("50");
    await page.getByRole("button", { name: "Issue invoice" }).click();

    await expect(page.getByPlaceholder("Description")).toHaveValue("");

    await page.getByTestId("invoices-table").locator("tbody tr a").last().click();
    await page.waitForURL("**/invoices/[^/]+$");

    await expect(page.getByText(description, { exact: true })).toBeVisible();

    expect(errors).toEqual([]);
  });
});