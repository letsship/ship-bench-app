import { expect, test } from "@playwright/test";
import { resetBackend } from "./support/auth";

const PAYLOAD = `<img src=x onerror=alert(document.cookie)>`;

// Stored-XSS regression: invoice line-item descriptions are free text entered
// by staff and must never be interpreted as markup on the detail page. The
// payload below would create an element and fire its handler if the page
// injected the description as raw HTML.
test.describe("invoice line description escaping", () => {
  test.beforeEach(async ({ request }) => {
    await resetBackend(request);
  });

  test("renders an HTML-carrying description as inert literal text", async ({ page }) => {
    let dialogs = 0;
    page.on("dialog", (dialog) => {
      dialogs += 1;
      void dialog.dismiss();
    });

    // Create the malicious invoice through the operator-facing form.
    await page.goto("/invoices");
    const form = page.getByRole("form", { name: "New invoice" });
    await expect(form).toBeVisible();
    await form.getByPlaceholder("Description").fill(PAYLOAD);
    await form.getByLabel("Unit price").fill("10.00");
    const table = page.getByTestId("invoices-table");
    const rowsBefore = await table.locator("tbody tr").count();
    await form.getByRole("button", { name: "Issue invoice" }).click();

    // Wait for the create + refresh to land, then open the newest invoice.
    await expect(table.locator("tbody tr")).toHaveCount(rowsBefore + 1);
    await table.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/invoices\/[^/]+$/);

    // (1) The payload appears as literal, escaped text…
    await expect(page.getByText(PAYLOAD)).toBeVisible();
    // (2) …and no element was materialized from it.
    await expect(page.locator("table img")).toHaveCount(0);
    // (3) No `onerror` handler ever ran.
    expect(dialogs).toBe(0);
  });
});
