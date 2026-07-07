import { type Page, expect, test } from "@playwright/test";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

test("line-item description with HTML is rendered as escaped text, not executed", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  const maliciousDesc = '<img src=x onerror="alert(document.cookie)">';

  await signIn(page);
  await page.goto("/invoices");

  const form = page.getByRole("form", { name: "New invoice" });
  const descriptionInput = form.getByPlaceholder("Description");
  await descriptionInput.fill(maliciousDesc);
  await form.getByLabel("Quantity").fill("1");
  await form.getByLabel("Unit price").fill("10.00");
  await form.getByRole("button", { name: "Issue invoice" }).click();

  await page.waitForURL("**/invoices/**");

  const escapedText = page.getByText(maliciousDesc, { exact: true });
  await expect(escapedText).toBeVisible();

  const injected = page.locator('img[src="x"]');
  await expect(injected).toHaveCount(0);

  expect(errors).toEqual([]);
});

test("ordinary line-item description renders as readable text", async ({ page }) => {
  await signIn(page);
  await page.goto("/invoices");

  const form = page.getByRole("form", { name: "New invoice" });
  const descriptionInput = form.getByPlaceholder("Description");
  await descriptionInput.fill("Monthly membership");
  await form.getByLabel("Quantity").fill("1");
  await form.getByLabel("Unit price").fill("49.00");
  await form.getByRole("button", { name: "Issue invoice" }).click();

  await page.waitForURL("**/invoices/**");

  await expect(page.getByText("Monthly membership", { exact: true })).toBeVisible();
});
