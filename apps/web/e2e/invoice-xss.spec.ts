import { type Page, expect, test } from "@playwright/test";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

async function createInvoice(page: Page, description: string): Promise<void> {
  await page.goto("/invoices");
  const table = page.getByTestId("invoices-table");
  const initialRowCount = await table.locator("tbody tr").count();

  const form = page.getByRole("form", { name: "New invoice" });
  await form.getByPlaceholder("Description").fill(description);
  await form.getByLabel("Quantity").fill("1");
  await form.getByLabel("Unit price").fill("10.00");
  await form.getByRole("button", { name: "Issue invoice" }).click();

  // Invoices sort newest-first, so the new row lands at the top once the
  // server-refreshed list confirms the invoice was created.
  await expect(table.locator("tbody tr")).toHaveCount(initialRowCount + 1);
}

test("a malicious line-item description renders as inert text, not markup", async ({ page }) => {
  await signIn(page);

  const payload = '<img src=x onerror="window.__sb_xss=true">';
  await createInvoice(page, payload);

  await page.getByTestId("invoices-table").locator("tbody tr").first().locator("a").click();

  await expect(page.getByText(payload)).toBeVisible();
  await expect(page.locator("img[onerror]")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __sb_xss?: boolean }).__sb_xss)).toBe(
    undefined,
  );
});

test("an ordinary line-item description still renders as readable text", async ({ page }) => {
  await signIn(page);

  await createInvoice(page, "10-class pass");

  await page.getByTestId("invoices-table").locator("tbody tr").first().locator("a").click();

  await expect(page.getByText("10-class pass")).toBeVisible();
});
