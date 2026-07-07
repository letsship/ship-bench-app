import { type Page, expect, test } from "@playwright/test";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

test("invoice line-item description containing HTML is rendered as escaped text with no execution", async ({ page }) => {
  const errors: string[] = [];
  const dialogs: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });

  await signIn(page);
  await page.goto("/invoices");

  // Fill out and submit the form.
  const form = page.getByRole("form", { name: "New invoice" });
  await form.getByPlaceholder("Description").fill('<img src=x onerror="alert(document.cookie)">');
  await form.getByLabel("Unit price").fill("10.00");

  const [postResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/invoices") && response.request().method() === "POST"),
    form.getByRole("button", { name: "Issue invoice" }).click(),
  ]);

  const body = await postResponse.json();
  const invoiceId: string = body.invoice.id;
  await page.goto(`/invoices/${invoiceId}`);

  // Assert the literal payload text is visible, proving it was not interpreted as markup.
  await expect(page.getByText('<img src=x onerror="alert(document.cookie)">', { exact: true })).toBeVisible();

  // Assert no real <img> element was injected.
  expect(await page.locator('img[src="x"]').count()).toBe(0);

  // Assert no dialog fired and no console/page errors occurred.
  expect(dialogs).toEqual([]);
  expect(errors).toEqual([]);
});
