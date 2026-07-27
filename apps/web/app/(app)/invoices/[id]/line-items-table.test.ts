import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { InvoiceLineItem } from "@/lib/db/types";
import { LineItemsTable } from "./line-items-table";

describe("LineItemsTable", () => {
  it("escapes HTML markup in line descriptions", () => {
    const lineItems: InvoiceLineItem[] = [
      {
        id: "1",
        invoiceId: "inv-1",
        description: '<img src=x onerror="alert(1)">',
        quantity: 1,
        unitAmountCents: 1000,
        amountCents: 1000,
        refunded: false,
        bookingId: null,
      },
    ];

    const html = renderToStaticMarkup(
      createElement(LineItemsTable, {
        lineItems,
        currency: "USD",
      }),
    );

    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('onerror="');
  });

  it("renders plain text descriptions verbatim", () => {
    const lineItems: InvoiceLineItem[] = [
      {
        id: "1",
        invoiceId: "inv-1",
        description: "Monthly membership",
        quantity: 1,
        unitAmountCents: 5000,
        amountCents: 5000,
        refunded: false,
        bookingId: null,
      },
    ];

    const html = renderToStaticMarkup(
      createElement(LineItemsTable, {
        lineItems,
        currency: "USD",
      }),
    );

    expect(html).toContain("Monthly membership");
  });
});
