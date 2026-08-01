import { expect, test } from "@playwright/test";
import { resetBackend } from "./support/auth";

// Regression guard for a stored XSS: invoice line-item descriptions are staff
// free text, and the detail page must render them as inert, escaped text —
// never as HTML. See apps/web/app/(app)/invoices/[id]/page.tsx.
const XSS_PAYLOAD = '<img src=x onerror="alert(document.cookie)">';
const PLAIN_DESCRIPTION = "Ben & Jerry's monthly pass";

test.describe("invoice detail escapes line-item descriptions", () => {
  test.beforeEach(async ({ request }) => {
    await resetBackend(request);
  });

  test("an HTML payload renders verbatim and creates no element", async ({ page, request }) => {
    // Create the invoice through the authed API (the `request` fixture shares the
    // operator session) so the test lands on a known invoice id deterministically.
    const members: Array<{ id: string }> = await (await request.get("/api/members")).json();
    expect(members.length).toBeGreaterThan(0);

    const response = await request.post("/api/invoices", {
      data: {
        memberId: members[0].id,
        lineItems: [
          { description: XSS_PAYLOAD, quantity: 1, unitAmountCents: 100 },
          { description: PLAIN_DESCRIPTION, quantity: 1, unitAmountCents: 2500 },
        ],
      },
    });
    expect(response.status()).toBe(201);
    const { invoice } = (await response.json()) as { invoice: { id: string } };

    const dialogs: string[] = [];
    page.on("dialog", (dialog) => {
      dialogs.push(dialog.message());
      void dialog.dismiss();
    });

    await page.goto(`/invoices/${invoice.id}`);
    await expect(page.getByRole("columnheader", { name: "Description" })).toBeVisible();

    // The markup shows as literal text: the payload is visible verbatim, and no
    // <img> element (or its onerror handler) was ever created from it.
    await expect(page.getByText(XSS_PAYLOAD)).toBeVisible();
    await expect(page.locator('img[src="x"]')).toHaveCount(0);
    expect(dialogs).toEqual([]);

    // Ordinary text still reads normally — a double-escaping regression would
    // render "&amp;" and this exact-text locator would no longer match.
    await expect(page.getByText(PLAIN_DESCRIPTION)).toBeVisible();
  });
});
