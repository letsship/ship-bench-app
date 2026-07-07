import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoiceLineItemsTable } from "./line-items-table";
import type { InvoiceLineItem } from "@/lib/db/types";

function makeLine(overrides: Partial<InvoiceLineItem> = {}): InvoiceLineItem {
  return {
    id: "li_1",
    invoiceId: "inv_1",
    description: "Studio rental",
    quantity: 1,
    unitAmountCents: 10000,
    amountCents: 10000,
    refunded: false,
    bookingId: null,
    ...overrides,
  };
}

describe("InvoiceLineItemsTable", () => {
  it("renders an HTML-injected description as inert, escaped text", () => {
    const payload = `<img src=x onerror="alert(document.cookie)">`;
    const html = renderToStaticMarkup(
      createElement(InvoiceLineItemsTable, {
        lineItems: [makeLine({ description: payload })],
        currency: "USD",
      }),
    );

    // The payload must appear verbatim as escaped text...
    expect(html).toContain("&lt;img src=x onerror=");
    expect(html).toContain("&quot;alert(document.cookie)&quot;&gt;");
    // ...and must never produce a live element or unescaped handler attribute.
    expect(html).not.toContain("<img");
    expect(html).not.toContain('onerror="');
  });

  it("renders an ordinary plain-text description verbatim and readably", () => {
    const html = renderToStaticMarkup(
      createElement(InvoiceLineItemsTable, {
        lineItems: [makeLine({ description: "Studio rental — 2 hours" })],
        currency: "USD",
      }),
    );

    expect(html).toContain("Studio rental — 2 hours");
  });
});
