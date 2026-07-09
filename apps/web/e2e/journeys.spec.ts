import { expect, test } from "@playwright/test";
import { AUTHED_PATHS, signIn } from "./support/auth";

// Core operator journeys exercised end-to-end against a production `next start`
// server in fake-backends mode. These are happy-path regression checks over the
// features the app already ships (booking, invoicing, roster, reporting,
// navigation) — deterministic against the seeded in-memory dataset, no network.
test.describe("operator journeys (fake backends)", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("books a member into a class and sees it on the bookings list", async ({ page }) => {
    await page.goto("/bookings");
    const form = page.getByRole("form", { name: "New booking" });
    await expect(form).toBeVisible();

    const member = ((await form.getByLabel("Member").locator("option:checked").textContent()) ?? "").trim();
    await form.getByRole("button", { name: "Book" }).click();

    // The POST resolves to a booked/waitlisted confirmation, then the list refreshes.
    await expect(form.getByText(/Booked!|waitlist/i)).toBeVisible();
    if (member) await expect(page.getByTestId("bookings")).toContainText(member);
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

  test("every authenticated page loads, holds the session, and logs zero console errors", async ({ page }) => {
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
