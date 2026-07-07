import { type Page, expect, test } from "@playwright/test";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

const XSS_PAYLOAD = '<img src=x onerror="window.__xssFired = true">';

test("invoice line-item description renders escaped text, not raw HTML", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await signIn(page);
  await page.goto("/invoices");

  const form = page.getByRole("form", { name: "New invoice" });
  await form.getByPlaceholder("Description").fill(XSS_PAYLOAD);
  await form.getByLabel("Quantity").fill("1");
  await form.getByLabel("Unit price").fill("10.00");
  await form.getByRole("button", { name: "Issue invoice" }).click();

  // Wait for the invoices table to appear (if it was empty before) and contain a link.
  const table = page.getByTestId("invoices-table");
  await expect(table.locator("tbody tr").first()).toBeVisible();

  // The newly created invoice should be the last row; click its number link.
  const invoiceLink = table.locator("tbody tr:last-child a").first();
  await expect(invoiceLink).toBeVisible();
  await invoiceLink.click();

  // We should now be on the invoice detail page.
  await expect(page.getByRole("heading")).toBeVisible();

  // The description cell must contain the literal payload string as text.
  const descriptionCell = page.locator("table tbody tr:first-child td").first();
  await expect(descriptionCell).toHaveText(XSS_PAYLOAD);

  // No <img> element should have been created inside the cell.
  await expect(descriptionCell.locator("img")).toHaveCount(0);

  // XSS flag should never have been set by the onerror handler.
  const xssFired = await page.evaluate(() => (window as Window & { __xssFired?: boolean }).__xssFired);
  expect(xssFired).toBeUndefined();

  // No console errors or page errors should have fired.
  expect(errors).toEqual([]);
});
