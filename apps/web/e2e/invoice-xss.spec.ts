import { type Page, expect, test } from "@playwright/test";

const XSS_PAYLOAD = '<img src=x onerror="window.__xssFired=true">';
const PLAIN_DESCRIPTION = "Private session — 60 minutes";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

test("a line-item description containing HTML renders as inert escaped text", async ({ page }) => {
  await signIn(page);
  await page.goto("/invoices");

  const form = page.getByRole("form", { name: "New invoice" });
  const descriptionInputs = form.getByPlaceholder("Description");
  await descriptionInputs.first().fill(XSS_PAYLOAD);
  await form.getByLabel("Quantity").first().fill("1");
  await form.getByLabel("Unit price").first().fill("10.00");

  await form.getByRole("button", { name: "+ Add line" }).click();
  await descriptionInputs.nth(1).fill(PLAIN_DESCRIPTION);
  await form.getByLabel("Quantity").nth(1).fill("1");
  await form.getByLabel("Unit price").nth(1).fill("5.00");

  const rowCountBefore = await page.getByTestId("invoices-table").locator("tbody tr").count();

  await form.getByRole("button", { name: "Issue invoice" }).click();

  // The form clears its fields once the invoice is created and the list refreshes.
  await expect(descriptionInputs.first()).toHaveValue("");

  const invoicesTable = page.getByTestId("invoices-table");
  await expect(invoicesTable.locator("tbody tr")).toHaveCount(rowCountBefore + 1);
  await invoicesTable.locator("tbody tr").first().locator("a").click();

  await page.waitForURL("**/invoices/**");

  // The raw markup must appear verbatim as text, not be parsed into an element.
  await expect(page.getByText(XSS_PAYLOAD, { exact: false })).toBeVisible();
  await expect(page.locator("table.sb-table img")).toHaveCount(0);
  const xssFired = await page.evaluate(() => (window as { __xssFired?: boolean }).__xssFired);
  expect(xssFired).toBeUndefined();

  // An ordinary description on the other line still renders as readable text.
  await expect(page.getByText(PLAIN_DESCRIPTION)).toBeVisible();
});
