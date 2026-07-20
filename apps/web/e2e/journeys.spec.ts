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

  // Click on the first invoice in the list
  const invoiceRow = page.getByRole("row").nth(1);
  await invoiceRow.click();

  // Verify invoice detail page renders
  await expect(page.getByRole("heading", { name: /INV-/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Total" })).toBeVisible();
});

test("opens the fully refunded invoice and renders normally", async ({ page }) => {
  await signIn(page);
  await page.goto("/invoices");

  // Find and click the Pottery intensive invoice (fully refunded for Femke)
  const potteryRow = page.getByRole("row").filter({ has: page.getByText("Pottery intensive") });
  await potteryRow.click();

  // Verify the invoice detail page renders without error
  await expect(page.getByRole("heading", { name: /INV-/i })).toBeVisible();

  // Verify the line items are displayed
  await expect(page.getByText("Pottery intensive")).toBeVisible();

  // Verify the refunded badge is shown
  await expect(page.getByRole("status", { name: /refunded/i })).toBeVisible();

  // Verify the total is €0.00
  await expect(page.getByText("€0.00")).toBeVisible();
});
