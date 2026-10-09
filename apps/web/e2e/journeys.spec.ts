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

  test("invoice line-item descriptions with HTML markup render as inert text", async ({
    page,
    request,
  }) => {
    const xssPayload = '<img src=x onerror="window.__xss=1">';
    const ordinaryDescription = "Monthly unlimited pass";

    const membersRes = await request.get("/api/members");
    const members = (await membersRes.json()) as unknown[];
    const firstMember =
      Array.isArray(members) && members[0] ? (members[0] as Record<string, unknown>) : null;
    if (!firstMember?.id) {
      throw new Error("No members in the test dataset");
    }

    const createRes = await request.post("/api/invoices", {
      data: {
        memberId: firstMember.id,
        lineItems: [
          {
            description: xssPayload,
            quantity: 1,
            unitAmountCents: 5000,
          },
          {
            description: ordinaryDescription,
            quantity: 2,
            unitAmountCents: 3000,
          },
        ],
      },
    });
    const invoice = (await createRes.json()) as unknown;
    const invoiceDetail =
      invoice && typeof invoice === "object" ? (invoice as Record<string, unknown>) : null;
    const invoiceId =
      invoiceDetail?.invoice && typeof invoiceDetail.invoice === "object"
        ? (invoiceDetail.invoice as Record<string, unknown>).id
        : null;
    if (!invoiceId || typeof invoiceId !== "string") {
      throw new Error("Failed to parse invoice id from response");
    }

    await page.goto(`/invoices/${invoiceId}`);
    const table = page.getByRole("table");
    await expect(table).toBeVisible();

    // The XSS payload should render as visible text, not as a DOM element.
    await expect(page.getByText(xssPayload)).toBeVisible();
    // No img element should be created by the payload.
    expect(await table.locator("img").count()).toBe(0);
    // The onerror handler should never have fired.
    expect(await page.evaluate(() => (window as Record<string, unknown>).__xss)).toBeUndefined();
    // The ordinary description should be visible and readable.
    await expect(page.getByText(ordinaryDescription)).toBeVisible();
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
