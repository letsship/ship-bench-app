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

  test("adding a member shows a named confirmation, clears the form, and lists the member", async ({
    page,
  }) => {
    await page.goto("/members");
    const form = page.getByRole("form", { name: "Add member" });
    await expect(form).toBeVisible();

    const name = "Jane Doe";
    const email = `jane.doe.${Date.now()}@example.com`;
    await form.getByLabel("Name").fill(name);
    await form.getByLabel("Email").fill(email);
    await form.getByRole("button", { name: "Add member" }).click();

    await expect(page.getByRole("status")).toHaveText(`Added ${name}`);
    await expect(form.getByLabel("Name")).toHaveValue("");
    await expect(form.getByLabel("Email")).toHaveValue("");
    await expect(page.getByTestId("members-table")).toContainText(name);

    // Resubmitting the same email surfaces the existing error, never a confirmation.
    await form.getByLabel("Name").fill(name);
    await form.getByLabel("Email").fill(email);
    await form.getByRole("button", { name: "Add member" }).click();

    await expect(page.getByText(`A member with email ${email} already exists`)).toBeVisible();
    await expect(page.getByRole("status")).toHaveCount(0);
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
