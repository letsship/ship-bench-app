import { type Page, expect, test } from "@playwright/test";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

test("invoice line-item description with HTML is rendered as inert text, not executed", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await signIn(page);
  await page.goto("/invoices");

  const form = page.getByRole("form", { name: "New invoice" });

  await form.getByPlaceholder("Description").first().fill(`<img src=x onerror="window.__xssFired = true">`);
  await form.getByLabel("Quantity").first().fill("1");
  await form.getByLabel("Unit price").first().fill("10.00");

  await form.getByRole("button", { name: "+ Add line" }).click();
  await form.getByPlaceholder("Description").nth(1).fill("Monthly tuition");
  await form.getByLabel("Quantity").nth(1).fill("1");
  await form.getByLabel("Unit price").nth(1).fill("20.00");

  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/invoices") && response.request().method() === "POST",
  );
  await form.getByRole("button", { name: "Issue invoice" }).click();
  const response = await responsePromise;
  const detail = (await response.json()) as { invoice: { id: string } };
  const invoiceId = detail.invoice.id;

  await page.goto(`/invoices/${invoiceId}`);

  await expect(
    page.getByText(`<img src=x onerror="window.__xssFired = true">`),
  ).toBeVisible();
  await expect(page.locator("table tbody img")).toHaveCount(0);
  await expect(page.getByText("Monthly tuition")).toBeVisible();

  const fired = await page.evaluate(() => {
    return (window as unknown as { __xssFired?: boolean }).__xssFired;
  });
  expect(fired).toBeUndefined();

  expect(errors).toEqual([]);
});
