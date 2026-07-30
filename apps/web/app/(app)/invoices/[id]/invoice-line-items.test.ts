import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { InvoiceLineItem } from "@/lib/db/types";
import { InvoiceLineItems } from "./invoice-line-items";

const XSS_PAYLOAD = '<img src=x onerror="alert(document.cookie)">';

function line(overrides: Partial<InvoiceLineItem> & { id: string }): InvoiceLineItem {
  return {
    invoiceId: "inv_1",
    description: "Studio session",
    quantity: 1,
    unitAmountCents: 5000,
    amountCents: 5000,
    refunded: false,
    bookingId: null,
    ...overrides,
  };
}

function render(lineItems: InvoiceLineItem[]) {
  return renderToStaticMarkup(createElement(InvoiceLineItems, { lineItems, currency: "USD" }));
}

describe("InvoiceLineItems", () => {
  it("renders a description containing HTML as inert escaped text", () => {
    const html = render([line({ id: "li_1", description: XSS_PAYLOAD })]);

    expect(html).toContain("&lt;img src=x onerror=");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('onerror="alert');
  });

  it("renders ordinary descriptions as readable text", () => {
    const html = render([line({ id: "li_1" })]);

    expect(html).toContain("Studio session");
  });

  it("keeps quantities, money and the refunded badge alongside the description", () => {
    const html = render([
      line({ id: "li_1", description: "Drop-in class", quantity: 2, amountCents: 10_000 }),
      line({ id: "li_2", description: "Cancelled add-on", refunded: true }),
    ]);

    expect(html).toContain("Drop-in class");
    expect(html).toContain("$100.00");
    expect(html).toContain("refunded");
  });
});
