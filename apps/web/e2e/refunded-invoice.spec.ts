import { expect, test } from "@playwright/test";
import { resetBackend } from "./support/auth";

// Regression for STB-954: opening the detail page of an invoice whose line
// items are ALL refunded used to throw "Reduce of empty array with no initial
// value" inside `computeInvoiceTotals` (the un-seeded `.reduce` over payable
// lines) and render the error screen instead of the page. The seeded fully-
// refunded "Pottery intensive" invoice for Femke Jansen (INVOICE_SEED
// memberIndex 5) is the fixture that tripped it in production.
test.describe("fully-refunded invoice detail (fake backends)", () => {
  test.beforeEach(async ({ request }) => {
    await resetBackend(request);
  });

  test("renders the all-refunded invoice with zero totals and a refunded line badge", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/invoices");
    const table = page.getByTestId("invoices-table");
    await expect(table).toBeVisible();

    // The seeded "Pottery intensive" invoice is the only one in status refunded.
    const refundedRow = table.getByRole("row", { name: /refunded/i });
    await expect(refundedRow).toBeVisible();
    await refundedRow.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/invoices\/[^/]+$/);

    // The detail renders instead of the error screen.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: /All invoices/i })).toBeVisible();

    // Refunded line is still listed and badged as refunded.
    await expect(page.getByText("Pottery intensive")).toBeVisible();
    await expect(page.getByText("Pottery intensive").locator("..").getByText(/refunded/i)).toBeVisible();

    // Subtotal, Tax, and Total all read the zero-money value.
    await expect(page.getByText(/^Subtotal/)).toContainText("€0.00");
    await expect(page.getByText(/Tax/).first()).toContainText("€0.00");
    await expect(page.getByText(/^Total/).first()).toContainText("€0.00");

    expect(errors).toEqual([]);
  });
});
