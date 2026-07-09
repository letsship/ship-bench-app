import { type Page, expect, test } from "@playwright/test";

const XSS_DESCRIPTION = '<img src=x onerror="alert(document.cookie)">';
const PLAIN_DESCRIPTION = "Private studio session";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

test("a malicious line-item description renders as inert text, not markup", async ({ page }) => {
  let dialogFired = false;
  page.on("dialog", (dialog) => {
    dialogFired = true;
    void dialog.dismiss();
  });

  await signIn(page);
  await page.goto("/invoices");

  const form = page.getByRole("form", { name: "New invoice" });
  const descriptionInputs = form.getByPlaceholder("Description");
  await descriptionInputs.nth(0).fill(XSS_DESCRIPTION);
  await form.getByLabel("Unit price").fill("10.00");

  await form.getByRole("button", { name: "+ Add line" }).click();
  await descriptionInputs.nth(1).fill(PLAIN_DESCRIPTION);
  await form.getByLabel("Unit price").nth(1).fill("5.00");

  const invoicesTable = page.getByTestId("invoices-table");
  const initialRowCount = await invoicesTable.locator("tbody tr").count();

  await form.getByRole("button", { name: "Issue invoice" }).click();
  await expect(invoicesTable.locator("tbody tr")).toHaveCount(initialRowCount + 1);

  // Invoices are sorted newest-first, so the invoice just issued is the first row.
  await invoicesTable.locator("tbody tr").first().getByRole("link").click();

  await expect(page.locator("table.sb-table")).toBeVisible();

  // The markup must be shown as literal text, never parsed into an element.
  await expect(page.getByText(XSS_DESCRIPTION, { exact: false })).toBeVisible();
  await expect(page.locator("img[src='x']")).toHaveCount(0);

  // An ordinary description on the second line item still renders normally.
  await expect(page.getByText(PLAIN_DESCRIPTION)).toBeVisible();

  expect(dialogFired).toBe(false);
});
