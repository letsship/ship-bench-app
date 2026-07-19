import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, it, expect } from "vitest";
import { InvoiceLineItems } from "./invoice-line-items";
import { type InvoiceLineItem } from "@/lib/db/types";

describe("InvoiceLineItems", () => {
  it("escapes HTML markup in descriptions to prevent XSS", () => {
    const xssPayload = '<img src=x onerror="alert(document.cookie)">';
    const lineItems: InvoiceLineItem[] = [
      {
        id: "1",
        invoiceId: "inv-1",
        description: xssPayload,
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
    expect(html).not.toContain("<img");
    expect(html).not.toContain('onerror="');
  });

  it("renders ordinary descriptions as readable text", () => {
    const lineItems: InvoiceLineItem[] = [
      {
        id: "1",
        invoiceId: "inv-1",
        description: "Professional consulting services",
        quantity: 5,
        unitAmountCents: 5000,
        amountCents: 25000,
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

    expect(html).toContain("Professional consulting services");
  });
});
