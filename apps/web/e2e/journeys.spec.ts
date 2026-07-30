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

  test("opens a fully-refunded invoice and reads its zero totals", async ({ page }) => {
    // Regression: an invoice whose every line is refunded has zero billable
    // lines, which used to crash the detail page with "Reduce of empty array
    // with no initial value" instead of rendering.
    await page.goto("/invoices");
    const table = page.getByTestId("invoices-table");
    await expect(table).toBeVisible();

    // Select by content (member + refunded badge), not row order — the in-memory
    // seed is shared across specs and retries.
    const row = table
      .locator("tbody tr")
      .filter({ hasText: "Femke Jansen" })
      .filter({ hasText: "refunded" });
    await row.getByRole("link").click();
    await expect(page).toHaveURL(/\/invoices\/[^/]+$/);

    // The page renders rather than the error screen: heading, the refunded line
    // still listed and badged, and every money figure at zero.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const line = page.locator("tbody tr").filter({ hasText: "Pottery intensive" });
    await expect(line).toBeVisible();
    await expect(line.getByText("refunded")).toBeVisible();

    await expect(page.getByTestId("invoice-subtotal")).toContainText("€0.00");
    await expect(page.getByTestId("invoice-tax")).toContainText("€0.00");
    await expect(page.getByTestId("invoice-total")).toContainText("€0.00");
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
});
