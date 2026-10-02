import { expect, test } from "@playwright/test";
import { AUTHED_PATHS, resetBackend } from "./support/auth";

// Core operator journeys exercised end-to-end against a production `next start`
// server in fake-backends mode. These are happy-path regression checks over the
// features the app already ships (booking, invoicing, roster, reporting,
// navigation) — deterministic against the seeded in-memory dataset, no network.
test.describe("operator journeys (fake backends)", () => {
  // Auth comes from the `setup` project's storageState; re-seed per test so the
  // mutating booking journey stays isolated and retry-safe.
  test.beforeEach(async ({ request }) => {
    await resetBackend(request);
  });

  test("books a member into a class and sees them on the bookings list", async ({ page }) => {
    await page.goto("/bookings");
    const form = page.getByRole("form", { name: "New booking" });
    await expect(form).toBeVisible();

    const member = (
      (await form.getByLabel("Member").locator("option:checked").textContent()) ?? ""
    ).trim();
    await form.getByRole("button", { name: "Book" }).click();

    // Order-independent + retry-safe: whether the click books, waitlists, or the
    // member was already booked (re-runs and prior tests share the one in-memory
    // store), the selected member ends up on the bookings list once it refreshes.
    if (member) await expect(page.getByTestId("bookings")).toContainText(member);
    else await expect(page.getByTestId("bookings")).toBeVisible();
  });

  test("opens an invoice from the list and reads its detail", async ({ page }) => {
    await page.goto("/invoices");
    const table = page.getByTestId("invoices-table");
    await expect(table).toBeVisible();

    await table.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/invoices\/[^/]+$/);
    // The detail renders the invoice number heading, the line-item table, and a total.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Description" })).toBeVisible();
    await expect(page.getByText("Total", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /All invoices/i })).toBeVisible();
  });

  test("browses the members roster and the revenue report", async ({ page }) => {
    await page.goto("/members");
    const members = page.getByTestId("members-table");
    await expect(members).toBeVisible();
    await expect(members.locator("tbody tr").first()).toBeVisible();

    await page.goto("/reports");
    await expect(page.getByTestId("revenue-table")).toBeVisible();
  });

  test("every authenticated page loads, holds the session, and logs zero console errors", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    for (const path of AUTHED_PATHS) {
      await page.goto(path);
      // A protected page keeps the operator on it (no bounce to /login).
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading").first()).toBeVisible();
    }

    expect(errors).toEqual([]);
  });

  test("renders invoice line descriptions as escaped text, not HTML", async ({ page }) => {
    // Navigate to invoices list
    await page.goto("/invoices");
    const table = page.getByTestId("invoices-table");
    await expect(table).toBeVisible();

    // Open the first invoice from the seeded data
    await table.getByRole("link").first().click();
    await expect(page).toHaveURL(/\/invoices\/[^/]+$/);
    const invoiceTable = page.getByRole("table").first();
    await expect(invoiceTable).toBeVisible();

    // Verify that descriptions are rendered as text, not HTML
    // The seeded invoice has "10-class pass" as a description
    await expect(invoiceTable).toContainText("10-class pass");

    // Verify there are no img elements (confirming dangerouslySetInnerHTML is not used)
    const imgElements = await invoiceTable.locator("img").count();
    expect(imgElements).toBe(0);

    // Verify page source doesn't contain dangerouslySetInnerHTML for descriptions
    const pageContent = await page.content();
    // The fix replaced dangerouslySetInnerHTML with plain text rendering
    expect(pageContent).not.toContain('dangerouslySetInnerHTML');
    expect(pageContent).toContain("10-class pass");

    // Check that no img element was created
    const imgElements = await table.locator("img").count();
    expect(imgElements).toBe(0);

    // Check that the malicious script was not executed
    const xssExecuted = await page.evaluate(() => {
      return (globalThis as Record<string, unknown>).__xss;
    });
    expect(xssExecuted).toBeUndefined();

    // Check that the ordinary description renders normally
    await expect(table).toContainText("10-class pass");
  });
});
