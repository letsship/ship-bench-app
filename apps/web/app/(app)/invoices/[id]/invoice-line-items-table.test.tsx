import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { InvoiceLineItem } from "@/lib/db/types";
import { InvoiceLineItemsTable } from "./invoice-line-items-table";

function makeLineItem(overrides: Partial<InvoiceLineItem>): InvoiceLineItem {
  return {
    id: "line-1",
    invoiceId: "invoice-1",
    description: "Studio rental, 2 hours",
    quantity: 1,
    unitAmountCents: 5000,
    amountCents: 5000,
    refunded: false,
    bookingId: null,
    ...overrides,
  };
}

describe("InvoiceLineItemsTable", () => {
  it("renders an HTML-bearing description as inert, escaped text", () => {
    const payload = '<img src=x onerror="alert(document.cookie)">';
    const html = renderToStaticMarkup(
      <InvoiceLineItemsTable lineItems={[makeLineItem({ description: payload })]} currency="usd" />,
    );

    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).not.toMatch(/onerror\s*=\s*"/);
  });

  it("renders an ordinary description as readable text", () => {
    const html = renderToStaticMarkup(
      <InvoiceLineItemsTable
        lineItems={[makeLineItem({ description: "Studio rental, 2 hours" })]}
        currency="usd"
      />,
    );

    expect(html).toContain("Studio rental, 2 hours");
  });
});
