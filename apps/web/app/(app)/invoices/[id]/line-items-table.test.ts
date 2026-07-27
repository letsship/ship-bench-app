import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { InvoiceLineItem } from "@/lib/db/types";
import { LineItemsTable } from "./line-items-table";

function lineItem(overrides: Partial<InvoiceLineItem> = {}): InvoiceLineItem {
  return {
    id: "li_1",
    invoiceId: "inv_1",
    description: "10-class pass",
    quantity: 1,
    unitAmountCents: 12000,
    amountCents: 12000,
    refunded: false,
    bookingId: null,
    ...overrides,
  };
}

function render(lineItems: InvoiceLineItem[]): string {
  return renderToStaticMarkup(createElement(LineItemsTable, { lineItems, currency: "usd" }));
}

describe("LineItemsTable", () => {
  it("escapes HTML in a line description instead of rendering it as markup", () => {
    const html = render([
      lineItem({ description: '<img src=x onerror="alert(document.cookie)">' }),
    ]);

    // The description survives verbatim, but every markup character is escaped,
    // so it lands in a text node instead of creating an element or handler.
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(document.cookie)&quot;&gt;");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('onerror="');
  });

  it("renders an ordinary description as readable text", () => {
    const html = render([lineItem({ description: "10-class pass" })]);

    expect(html).toContain("10-class pass");
  });

  it("still shows the refunded badge alongside the description", () => {
    const html = render([lineItem({ description: "Cancelled workshop", refunded: true })]);

    expect(html).toContain("Cancelled workshop");
    expect(html).toContain("refunded");
  });
});
