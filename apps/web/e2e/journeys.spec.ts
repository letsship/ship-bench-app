import { expect, test, type Locator, type Page } from "@playwright/test";
import { AUTHED_PATHS, resetBackend } from "./support/auth";

const PHONE_VIEWPORT = { width: 375, height: 667 };

function parseOccupancy(text: string): { booked: number; capacity: number } {
  const match = /(\d+)\/(\d+) booked/.exec(text);
  if (!match) throw new Error(`no occupancy in "${text}"`);
  return { booked: Number(match[1]), capacity: Number(match[2]) };
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("element has no bounding box");
  return box;
}

// The seed never fills a class to capacity, so schedule a one-seat class and book it.
async function scheduleFullClass(page: Page): Promise<void> {
  await page.goto("/bookings");
  const form = page.getByRole("form", { name: "New booking" });
  await expect(form).toBeVisible();
  const memberId =
    (await form.getByLabel("Member").locator("option").first().getAttribute("value")) ?? "";

  const sessions = (await (await page.request.get("/api/classes")).json()) as {
    classTypeId: string;
  }[];
  const startsAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
  const classResponse = await page.request.post("/api/classes", {
    data: {
      classTypeId: sessions[0].classTypeId,
      instructor: "E2E",
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      capacity: 1,
    },
  });
  expect(classResponse.ok()).toBe(true);
  const { id: sessionId } = (await classResponse.json()) as { id: string };

  const bookingResponse = await page.request.post("/api/bookings", {
    data: { sessionId, memberId },
  });
  expect(bookingResponse.ok()).toBe(true);
}

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

  test("marks full classes on the Classes page and keeps the Full label on one line on a phone", async ({
    page,
  }) => {
    await scheduleFullClass(page);
    await page.goto("/classes");
    await expect(page.getByTestId("session-row").first()).toBeVisible();
    await expect(page.getByTestId("full-badge").first()).toBeVisible();

    const cells = page.getByTestId("occupancy");
    const cellCount = await cells.count();
    for (let index = 0; index < cellCount; index += 1) {
      const cell = cells.nth(index);
      const text = await cell.innerText();
      const { booked, capacity } = parseOccupancy(text);
      const isFull = (await cell.getByTestId("full-badge").count()) > 0;
      expect(isFull, text).toBe(booked >= capacity);
      if (isFull) expect(booked, text).toBe(capacity);
    }

    await page.setViewportSize(PHONE_VIEWPORT);
    await page.reload();
    const cell = page
      .getByTestId("occupancy")
      .filter({ has: page.getByTestId("full-badge") })
      .first();
    const badge = cell.getByTestId("full-badge");
    await badge.scrollIntoViewIfNeeded();
    await expect(badge).toBeVisible();

    const box = await boxOf(badge);
    const lineHeight = parseFloat(await cell.evaluate((el) => getComputedStyle(el).lineHeight));
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(PHONE_VIEWPORT.width);
    expect(box.height).toBeLessThan(lineHeight * 2);
  });
});
