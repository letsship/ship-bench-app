import { type Page, expect, test } from "@playwright/test";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

test("line-item description with HTML is rendered as escaped text, not executed", async ({ page }) => {
  await signIn(page);
  await page.goto("/invoices");

  // Submit the New invoice form with a malicious line-item description.
  const form = page.getByRole("form", { name: "New invoice" });
  await form.getByPlaceholder("Description").fill('<img src=x onerror="window.__xssFired = true">');
  await form.getByLabel("Quantity").fill("1");
  await form.getByLabel("Unit price").fill("10.00");
  await form.getByRole("button", { name: "Issue invoice" }).click();

  // Wait for the form to reset after the server refresh completes.
  await expect(form.getByPlaceholder("Description")).toHaveValue("");

  // Open the newest invoice's detail page (first row in the table).
  const firstInvoiceLink = page
    .getByTestId("invoices-table")
    .locator("tbody tr")
    .first()
    .getByRole("link");
  await firstInvoiceLink.click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("line-item-description")).toBeVisible();

  // 1. The description appears as literal escaped text, not as rendered HTML.
  const description = page.getByTestId("line-item-description");
  await expect(description).toHaveText('<img src=x onerror="window.__xssFired = true">');

  // 2. No <img src="x"> element was created in the DOM.
  await expect(page.locator('img[src="x"]')).toHaveCount(0);

  // 3. The onerror handler never fired — window.__xssFired was never set.
  const xssFired = await page.evaluate(() => (window as Record<string, unknown>).__xssFired);
  expect(xssFired).toBeUndefined();
});

test("ordinary plain-text description renders normally", async ({ page }) => {
  await signIn(page);
  await page.goto("/invoices");

  // Submit the form with a benign description.
  const form = page.getByRole("form", { name: "New invoice" });
  await form.getByPlaceholder("Description").fill("Private yoga session");
  await form.getByLabel("Quantity").fill("1");
  await form.getByLabel("Unit price").fill("50.00");
  await form.getByRole("button", { name: "Issue invoice" }).click();

  // Wait for the form to reset after the server refresh.
  await expect(form.getByPlaceholder("Description")).toHaveValue("");

  // Open the newest invoice detail page.
  const firstInvoiceLink = page
    .getByTestId("invoices-table")
    .locator("tbody tr")
    .first()
    .getByRole("link");
  await firstInvoiceLink.click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByTestId("line-item-description")).toBeVisible();

  // Assert the plain-text description renders as readable text.
  await expect(page.getByTestId("line-item-description")).toHaveText("Private yoga session");
});