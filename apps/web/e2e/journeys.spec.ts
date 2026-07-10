import { type Page, expect, test } from "@playwright/test";

async function signIn(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill("operator@riverbank.studio");
  await page.getByRole("button", { name: "Send magic link" }).click();
  await page.waitForURL("**/dashboard");
}

test("opening a fully-refunded invoice renders zero totals instead of erroring", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await signIn(page);
  await page.goto("/invoices");

  const row = page.getByTestId("invoices-table").locator("tr", { hasText: "Femke Jansen" });
  await row.getByRole("link").click();

  const lineItemRow = page.locator("table tr", { hasText: "Pottery intensive" });
  await expect(lineItemRow).toBeVisible();
  await expect(lineItemRow.getByText("refunded")).toBeVisible();

  await expect(page.getByText(/^Subtotal/)).toContainText("€0.00");
  await expect(page.getByText(/^Tax \(/)).toContainText("€0.00");
  await expect(page.getByText(/^Total/).last()).toContainText("€0.00");

  expect(errors).toEqual([]);
});

test("an invoice with billable lines keeps showing a non-zero subtotal", async ({ page }) => {
  await signIn(page);
  await page.goto("/invoices");

  const row = page.getByTestId("invoices-table").locator("tr", { hasText: "Deshi Tan" });
  await row.getByRole("link").click();

  await expect(page.getByText("Reformer 5-pack")).toBeVisible();
  await expect(page.getByText("Grip socks")).toBeVisible();
  await expect(page.getByText(/^Subtotal/)).not.toContainText("€0.00");
});
