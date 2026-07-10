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
  page.on("pageerror", (error) => errors.push(error.message));

  await signIn(page);
  await page.goto("/invoices");

  const row = page.getByTestId("invoices-table").locator("tr", { hasText: "Femke Jansen" });
  await row.getByRole("link").click();

  await page.waitForURL(/\/invoices\/.+/);
  await expect(page.getByText("Pottery intensive")).toBeVisible();
  await expect(page.getByText("refunded").first()).toBeVisible();

  await expect(page.getByTestId("invoice-subtotal")).toContainText("€0.00");
  await expect(page.getByTestId("invoice-tax")).toContainText("€0.00");
  await expect(page.getByTestId("invoice-total")).toContainText("€0.00");

  expect(errors).toEqual([]);
});
