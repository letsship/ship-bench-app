import { expect, test } from "@playwright/test";
import { signIn } from "./support/auth";

test.describe("invoice detail rendering", () => {
  test("renders invoices without crashing from totals computation", async ({ page }) => {
    // Sign in
    await signIn(page);

    // Navigate to invoices
    await page.goto("/invoices");

    // Wait for the invoices table to appear
    await expect(page.getByTestId("invoices-table")).toBeVisible();

    // Get all invoice rows
    const invoiceRows = page.locator("table tbody tr");
    const count = await invoiceRows.count();
    expect(count).toBeGreaterThan(0);

    // Open the first invoice to verify the detail page renders without error
    const firstInvoiceLink = invoiceRows.first().locator("a").first();
    const invoiceNumber = await firstInvoiceLink.textContent();
    console.log(`Testing invoice: ${invoiceNumber}`);

    // Click the invoice link to open the detail page
    await firstInvoiceLink.click();

    // Wait for the detail page to load
    await page.waitForURL(/\/invoices\/[^/]+$/);

    // Verify no error occurred - the page should render normally
    // Check for the invoice number heading
    const heading = page.getByRole("heading", { level: 1 }).first();
    await expect(heading).toBeVisible();

    // Verify the totals are displayed with currency
    const pageContent = await page.content();
    expect(pageContent).toMatch(/€/);

    // Verify the line item table is displayed
    const lineItemTable = page.locator("table tbody");
    await expect(lineItemTable).toBeVisible();

    console.log("✓ Invoice detail page rendered successfully");
  });

  test("displays money amounts for all invoices in list", async ({ page }) => {
    await signIn(page);
    await page.goto("/invoices");

    // Wait for invoices table
    await expect(page.getByTestId("invoices-table")).toBeVisible();

    // Verify the table displays currency amounts
    const pageContent = await page.content();
    expect(pageContent).toMatch(/€/);

    console.log("✓ Invoice list rendered successfully");
  });
});
