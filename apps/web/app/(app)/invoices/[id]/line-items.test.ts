import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, it, expect } from "vitest";
import { InvoiceLineItems } from "./line-items";
import type { InvoiceLineItem } from "@/lib/db/types";

describe("InvoiceLineItems", () => {
  it("escapes HTML in descriptions to prevent XSS", () => {
    const lineItems: InvoiceLineItem[] = [
      {
        id: "1",
        invoiceId: "invoice-1",
        description: '<img src=x onerror="alert(document.cookie)">',
        quantity: 1,
        unitAmountCents: 1000,
        amountCents: 1000,
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
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<img class=");
  });

  it("renders ordinary descriptions as readable text", () => {
    const lineItems: InvoiceLineItem[] = [
      {
        id: "1",
        invoiceId: "invoice-1",
        description: "Studio rental — March",
        quantity: 1,
        unitAmountCents: 5000,
        amountCents: 5000,
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

    expect(html).toContain("Studio rental — March");
  });

  it("renders refunded status badge when refunded is true", () => {
    const lineItems: InvoiceLineItem[] = [
      {
        id: "1",
        invoiceId: "invoice-1",
        description: "Service",
        quantity: 1,
        unitAmountCents: 1000,
        amountCents: 1000,
        refunded: true,
        bookingId: null,
      },
    ];

    const html = renderToStaticMarkup(
      React.createElement(InvoiceLineItems, {
        lineItems,
        currency: "USD",
      }),
    );

    expect(html).toContain("refunded");
  });
});
