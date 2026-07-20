import { type Page, expect, test } from "@playwright/test";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

test("opens an invoice from the list and reads its detail", async ({ page }) => {
  await signIn(page);
  await page.goto("/invoices");

  // Click the first invoice number link in the table (skip header row with nth(1))
  const firstInvoiceLink = page.locator("table tbody tr").first().locator("a");
  await firstInvoiceLink.click();

  // Verify invoice detail page renders
  await expect(page.getByRole("heading", { name: /INV-/i })).toBeVisible();
  // Verify the Total section with money value is visible
  await expect(page.locator(".sb-card").filter({ hasText: "Total" })).toBeVisible();
});

test("opens the fully refunded invoice and renders normally", async ({ page }) => {
  await signIn(page);
  await page.goto("/invoices");

  // Find Femke's invoice in the list and click the invoice number link
  const femkeRow = page.locator("table tbody tr").filter({ hasText: "Femke" });
  const invoiceLink = femkeRow.locator("a");
  await invoiceLink.click();

  // Verify the invoice detail page renders without error
  await expect(page.getByRole("heading", { name: /INV-/i })).toBeVisible();

  // Verify the line items are displayed
  await expect(page.getByText("Pottery intensive")).toBeVisible();

  // Verify the refunded badge is shown (StatusBadge renders as span with "refunded" text)
  await expect(page.locator("span.sb-badge").filter({ hasText: "refunded" })).toBeVisible();

  // Verify the total is €0.00 (look for the Total card with €0.00)
  await expect(
    page.locator(".sb-card").filter({ hasText: "Total" }).locator("text=/€0\\.00/"),
  ).toBeVisible();
});
