import { type Page, expect, test } from "@playwright/test";

// Regression test for a stored-XSS report: invoice line-item descriptions are
// free text entered by staff. The invoice detail page must render them as inert,
// escaped text — never as parsed markup — so a malicious value stored on one
// invoice cannot execute script against every later viewer.

const XSS_PAYLOAD = `<img src=x onerror="window.__xssFired = true">`;
const ORDINARY_DESCRIPTION = "Studio rental - evening slot";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

async function createInvoiceWithLines(
  page: Page,
  lines: Array<{ description: string; quantity: number; price: string }>,
): Promise<string> {
  await page.goto("/invoices");

  const form = page.getByRole("form", { name: "New invoice" });
  const descriptionInputs = form.getByPlaceholder("Description");
  const quantityInputs = form.getByLabel("Quantity");
  const priceInputs = form.getByLabel("Unit price");

  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      await form.getByRole("button", { name: "+ Add line" }).click();
    }
    const line = lines[i];
    await descriptionInputs.nth(i).fill(line.description);
    await quantityInputs.nth(i).fill(String(line.quantity));
    await priceInputs.nth(i).fill(line.price);
  }

  await form.getByRole("button", { name: "Issue invoice" }).click();

  // The invoices table lists newest first; the just-created invoice is on top.
  const newestLink = page
    .getByTestId("invoices-table")
    .locator("tbody tr")
    .first()
    .getByRole("link")
    .first();
  await expect(newestLink).toBeVisible();
  const href = await newestLink.getAttribute("href");
  expect(href).toBeTruthy();
  return href as string;
}

test("a malicious invoice line description renders as escaped text, not markup", async ({ page }) => {
  await signIn(page);

  const invoiceHref = await createInvoiceWithLines(page, [
    { description: XSS_PAYLOAD, quantity: 1, price: "10.00" },
    { description: ORDINARY_DESCRIPTION, quantity: 1, price: "40.00" },
  ]);

  await page.goto(invoiceHref);

  // The payload must never create an <img> element, and the onerror handler
  // must never fire.
  expect(await page.locator("img").count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __xssFired?: unknown }).__xssFired)).toBeUndefined();

  // The markup appears verbatim as inert text.
  const descriptionCell = page
    .locator("table tbody tr td")
    .first();
  await expect(descriptionCell).toContainText(XSS_PAYLOAD);
});

test("an ordinary invoice line description still renders as readable text", async ({ page }) => {
  await signIn(page);

  const invoiceHref = await createInvoiceWithLines(page, [
    { description: ORDINARY_DESCRIPTION, quantity: 1, price: "40.00" },
  ]);

  await page.goto(invoiceHref);

  const descriptionCell = page.locator("table tbody tr td").first();
  await expect(descriptionCell).toContainText(ORDINARY_DESCRIPTION);
  expect(await page.locator("img").count()).toBe(0);
});
