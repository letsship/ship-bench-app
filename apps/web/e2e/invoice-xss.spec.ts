import { type Page, expect, test } from "@playwright/test";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

test("invoice line descriptions render HTML payloads as inert text", async ({ page }) => {
  const payload = '<img src=x onerror="window.__xssFired = true">';
  const ordinaryDescription = "Monthly membership";

  await page.addInitScript(() => {
    (window as Window & { __xssFired?: boolean }).__xssFired = false;
  });

  await signIn(page);
  await page.goto("/invoices");

  const form = page.getByRole("form", { name: "New invoice" });
  await form.getByPlaceholder("Description").fill(payload);
  await form.getByLabel("Unit price").fill("1.00");
  await form.getByRole("button", { name: "+ Add line" }).click();
  await form.getByPlaceholder("Description").nth(1).fill(ordinaryDescription);
  await form.getByLabel("Unit price").nth(1).fill("2.00");

  const createdResponse = page.waitForResponse(
    (response) => response.url().endsWith("/api/invoices") && response.request().method() === "POST",
  );
  await form.getByRole("button", { name: "Issue invoice" }).click();
  const createdInvoice = (await (await createdResponse).json()) as { invoice: { id: string } };

  await page.goto(`/invoices/${createdInvoice.invoice.id}`);

  const maliciousCell = page.locator("td").filter({ hasText: payload }).first();
  await expect(maliciousCell).toBeVisible();
  await expect(maliciousCell.locator("img")).toHaveCount(0);
  await expect(page.locator("td").filter({ hasText: ordinaryDescription }).first()).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as Window & { __xssFired?: boolean }).__xssFired))
    .toBe(false);
});
