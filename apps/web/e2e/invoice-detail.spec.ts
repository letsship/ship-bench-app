import { expect, test } from "@playwright/test";
import { resetBackend } from "./support/auth";

// Regression spec for the production crash on fully-refunded invoices: with
// every line refunded there are zero billable lines, and totalling them used
// to throw "Reduce of empty array with no initial value", killing the page.
test.describe("invoice detail page (fake backends)", () => {
  test.beforeEach(async ({ request }) => {
    await resetBackend(request);
  });

  test("renders a fully-refunded invoice with zero totals and no error screen", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    // The seeded fully-refunded invoice is the 'refunded'-status row on the
    // list (Femke Jansen's "Pottery intensive") — navigate via the list rather
    // than a hardcoded id, since seed ids are generated.
    await page.goto("/invoices");
    const row = page
      .getByTestId("invoices-table")
      .locator("tbody tr")
      .filter({ hasText: "refunded" });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Femke Jansen");
    await row.getByRole("link").click();

    // The page renders instead of dying to the error screen.
    await expect(page).toHaveURL(/\/invoices\/[^/]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/INV-/);
    await expect(page.getByText(/Femke Jansen/)).toBeVisible();

    // The refunded line is still listed and badged as refunded.
    const line = page.getByRole("row", { name: /Pottery intensive/ });
    await expect(line).toBeVisible();
    await expect(line.locator(".sb-badge")).toHaveText("refunded");

    // Zero billable lines -> subtotal, tax, and total all render as €0.00.
    await expect(page.getByText(/^Subtotal €0\.00$/)).toBeVisible();
    await expect(page.getByText(/^Tax \(9\.0%\) €0\.00$/)).toBeVisible();
    await expect(page.getByText(/^Total €0\.00$/)).toBeVisible();

    expect(errors).toEqual([]);
  });
});
