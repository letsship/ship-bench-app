import { type Page, expect, test } from "@playwright/test";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

async function issueInvoice(page: Page, description: string): Promise<void> {
  await page.goto("/invoices");
  const rowsBefore = await page.getByTestId("invoices-table").locator("tbody tr").count();

  const form = page.getByRole("form", { name: "New invoice" });
  await form.getByPlaceholder("Description").fill(description);
  await form.getByLabel("Quantity").fill("1");
  await form.getByLabel("Unit price").fill("10.00");
  await form.getByRole("button", { name: "Issue invoice" }).click();

  await expect(page.getByTestId("invoices-table").locator("tbody tr")).toHaveCount(rowsBefore + 1, {
    timeout: 15_000,
  });
}

test("a malicious line-item description is rendered as inert text, not HTML", async ({ page }) => {
  const payload = '<img src=x onerror="alert(document.cookie)">';

  await signIn(page);
  await issueInvoice(page, payload);

  const invoiceLink = page.getByTestId("invoices-table").locator("tbody tr").first().locator("a");
  await invoiceLink.click();
  await page.waitForURL("**/invoices/**");

  // The payload must appear as literal text...
  await expect(page.locator("table.sb-table").first()).toContainText(payload);

  // ...and must never be parsed into a real <img> element (which would fire onerror).
  await expect(page.locator("img[src='x']")).toHaveCount(0);

  const dialogs: string[] = [];
  page.on("dialog", (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  await page.waitForTimeout(500);
  expect(dialogs).toEqual([]);
});

test("an ordinary line-item description still renders as readable text", async ({ page }) => {
  const description = "Studio rental — evening session";

  await signIn(page);
  await issueInvoice(page, description);

  const invoiceLink = page.getByTestId("invoices-table").locator("tbody tr").first().locator("a");
  await invoiceLink.click();
  await page.waitForURL("**/invoices/**");

  await expect(page.locator("table.sb-table").first()).toContainText(description);
});
