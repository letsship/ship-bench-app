import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoiceLineItems } from "./invoice-line-items";
import type { InvoiceLineItem } from "@/lib/db/types";

describe("InvoiceLineItems", () => {
  it("escapes HTML in description to prevent XSS", () => {
    const lineItems: InvoiceLineItem[] = [
      {
        id: "line-1",
        invoiceId: "invoice-1",
        description: '<img src=x onerror="alert(document.cookie)">',
        quantity: 1,
        unitAmountCents: 10000,
        amountCents: 10000,
        refunded: false,
        bookingId: null,
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(InvoiceLineItems, {
        lineItems,
        currency: "USD",
      }),
    );

    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('onerror="');
  });

  it("renders ordinary descriptions as readable text", () => {
    const lineItems: InvoiceLineItem[] = [
      {
        id: "line-1",
        invoiceId: "invoice-1",
        description: "Portrait session — 2 hrs",
        quantity: 1,
        unitAmountCents: 10000,
        amountCents: 10000,
        refunded: false,
        bookingId: null,
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(InvoiceLineItems, {
        lineItems,
        currency: "USD",
      }),
    );

    expect(html).toContain("Portrait session — 2 hrs");
  });
});
