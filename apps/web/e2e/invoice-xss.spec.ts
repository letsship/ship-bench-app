import { type Page, expect, test } from "@playwright/test";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

async function createInvoice(page: Page, description: string): Promise<void> {
  await page.goto("/invoices");
  const form = page.getByRole("form", { name: "New invoice" });
  await form.getByPlaceholder("Description").fill(description);
  await form.getByLabel("Unit price").fill("10.00");

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/api/invoices") && res.request().method() === "POST",
    ),
    form.getByRole("button", { name: "Issue invoice" }).click(),
  ]);
  const { invoice } = (await response.json()) as { invoice: { id: string } };

  await page.goto(`/invoices/${invoice.id}`);
}

test("a line-item description containing HTML renders as inert, escaped text", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await signIn(page);

  const payload = '<img src=x onerror="window.__xssFired = true">';
  await createInvoice(page, payload);

  await expect(page.getByText(payload)).toBeVisible();
  await expect(page.locator("table img")).toHaveCount(0);

  const xssFired = await page.evaluate(
    () => (window as unknown as Record<string, unknown>).__xssFired,
  );
  expect(xssFired).toBeUndefined();
  expect(errors).toEqual([]);
});

test("an ordinary line-item description still renders as readable text", async ({ page }) => {
  await signIn(page);

  const description = "Private lesson — 60 minutes";
  await createInvoice(page, description);

  await expect(page.getByText(description)).toBeVisible();
});
