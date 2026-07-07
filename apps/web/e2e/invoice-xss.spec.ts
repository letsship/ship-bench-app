import { type Page, expect, test } from "@playwright/test";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

test("invoice line-item description escapes HTML to prevent stored XSS", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await signIn(page);
  await page.goto("/invoices");

  const form = page.getByRole("form", { name: "New invoice" });
  await form.getByPlaceholder("Description").first().fill('<img src=x onerror="window.__xssFired = true">');
  await form.getByLabel("Quantity").first().fill("1");
  await form.getByLabel("Unit price").first().fill("10.00");

  await form.getByRole("button", { name: "+ Add line" }).click();
  await form.getByPlaceholder("Description").nth(1).fill("Monthly membership");
  await form.getByLabel("Quantity").nth(1).fill("1");
  await form.getByLabel("Unit price").nth(1).fill("5.00");

  await form.getByRole("button", { name: "Issue invoice" }).click();

  // Wait for the invoices list to refresh and show the new invoice total.
  await expect(page.getByText("€16.35")).toBeVisible();

  await page.getByRole("link", { name: /^INV-/i }).first().click();
  await page.waitForURL(/\/invoices\/[a-z0-9-]+/);

  const lineItemsTable = page.locator("table.sb-table");
  await expect(lineItemsTable).toBeVisible();

  // The XSS payload should appear as literal text, never as parsed HTML.
  const xssDescription = '<img src=x onerror="window.__xssFired = true">';
  await expect(page.getByText(xssDescription)).toBeVisible();

  const imgCount = await lineItemsTable.locator("img").count();
  expect(imgCount).toBe(0);

  const xssFired = await page.evaluate(() => (window as Record<string, unknown>).__xssFired);
  expect(xssFired).toBeUndefined();

  await expect(page.getByText("Monthly membership")).toBeVisible();

  expect(errors).toEqual([]);
});
