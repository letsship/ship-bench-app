import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, it, expect } from "vitest";
import { InvoiceLineItemsTable } from "./line-items-table";

describe("InvoiceLineItemsTable", () => {
  it("escapes HTML in description", () => {
    const lineItems = [
      {
        id: "1",
        invoiceId: "inv-1",
        description: '<img src=x onerror="alert(document.cookie)">',
        quantity: 1,
        unitAmountCents: 1000,
        amountCents: 1000,
        refunded: false,
        bookingId: null,
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(InvoiceLineItemsTable, {
        lineItems,
        currency: "USD",
      }),
    );

    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img src=x onerror");
    expect(html).not.toContain('onerror="');
  });

  it("renders ordinary descriptions as readable text", () => {
    const lineItems = [
      {
        id: "1",
        invoiceId: "inv-1",
        description: "Studio rental — 2 hours",
        quantity: 1,
        unitAmountCents: 5000,
        amountCents: 5000,
        refunded: false,
        bookingId: null,
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(InvoiceLineItemsTable, {
        lineItems,
        currency: "USD",
      }),
    );

    expect(html).toContain("Studio rental — 2 hours");
  });
});
