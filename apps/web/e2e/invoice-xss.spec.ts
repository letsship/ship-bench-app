import { expect, test } from "@playwright/test";
import { resetBackend } from "./support/auth";

test.describe("invoice line descriptions", () => {
  test.beforeEach(async ({ request }) => {
    await resetBackend(request);
  });

  test("renders HTML descriptions as inert text", async ({ page }) => {
    const description = "Studio session <img src=x onerror=alert(1)>";

    await page.goto("/invoices");
    const form = page.getByRole("form", { name: "New invoice" });
    await expect(form).toBeVisible();
    await form.getByPlaceholder("Description").fill(description);
    await form.getByLabel("Quantity").fill("1");
    await form.getByLabel("Unit price").fill("25.00");

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/invoices") &&
        response.request().method() === "POST" &&
        response.status() === 201,
    );
    await form.getByRole("button", { name: "Issue invoice" }).click();

    const invoice = await (await createResponse).json();
    await page.getByTestId("invoices-table").getByRole("link", { name: invoice.invoice.number }).click();
    await expect(page).toHaveURL(new RegExp(`/invoices/${invoice.invoice.id}$`));

    const descriptionCell = page.getByRole("cell", { name: description, exact: true });
    await expect(descriptionCell).toBeVisible();
    await expect(page.locator("img[src=x]")).toHaveCount(0);
  });
});
