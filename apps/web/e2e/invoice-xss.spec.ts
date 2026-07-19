import { type Page, expect, test } from "@playwright/test";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

test("invoice line description with HTML payload renders as escaped text, not interpreted markup", async ({
  page,
}) => {
  const xssPayload = '<img src=x onerror="alert(document.cookie)">';

  // Track console errors and page errors to ensure the XSS handler doesn't fire.
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await signIn(page);
  await page.goto("/invoices");

  // Use the "New invoice" form to create an invoice with the XSS payload description.
  const form = page.getByRole("form", { name: "New invoice" });
  await form.locator('input[placeholder="Description"]').fill(xssPayload);
  await form.locator('input[aria-label="Quantity"]').fill("1");
  await form.locator('input[aria-label="Unit price"]').fill("10.00");
  await form.getByRole("button", { name: "Issue invoice" }).click();

  // Wait for the invoice to be created and the page to refresh.
  await page.waitForLoadState("networkidle");

  // Find and click the first invoice in the table to open its detail page.
  const firstInvoiceLink = page.locator("table tbody tr").first().locator("a").first();
  await firstInvoiceLink.click();

  // Verify the page navigated to an invoice detail page.
  await expect(page).toHaveURL(/\/invoices\/[a-z0-9-]+/);

  // Assert the XSS payload is rendered as literal text, not HTML.
  await expect(
    page.locator("[data-testid='invoice-line-items']").getByText(xssPayload, { exact: true }),
  ).toBeVisible();

  // Assert no injected <img> element was created under the line-items table.
  expect(await page.locator("[data-testid='invoice-line-items'] img").count()).toBe(0);

  // Assert no console errors or page errors occurred (the onerror handler never fired).
  expect(errors).toEqual([]);
});

test("invoice line description with ordinary text renders as readable text", async ({ page }) => {
  const ordinaryDescription = "Piano lesson - 30 minutes";

  await signIn(page);
  await page.goto("/invoices");

  // Use the "New invoice" form to create an invoice with an ordinary description.
  const form = page.getByRole("form", { name: "New invoice" });
  await form.locator('input[placeholder="Description"]').fill(ordinaryDescription);
  await form.locator('input[aria-label="Quantity"]').fill("1");
  await form.locator('input[aria-label="Unit price"]').fill("50.00");
  await form.getByRole("button", { name: "Issue invoice" }).click();

  // Wait for the invoice to be created and the page to refresh.
  await page.waitForLoadState("networkidle");

  // Find and click the first invoice in the table to open its detail page.
  const firstInvoiceLink = page.locator("table tbody tr").first().locator("a").first();
  await firstInvoiceLink.click();

  // Verify the page navigated to an invoice detail page.
  await expect(page).toHaveURL(/\/invoices\/[a-z0-9-]+/);

  // Assert the ordinary description is rendered as readable text.
  await expect(
    page
      .locator("[data-testid='invoice-line-items']")
      .getByText(ordinaryDescription, { exact: true }),
  ).toBeVisible();
});
