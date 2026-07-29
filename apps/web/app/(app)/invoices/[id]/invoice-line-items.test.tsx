import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvoiceLineItems } from "./invoice-line-items";

describe("InvoiceLineItems", () => {
  it("escapes HTML in a line-item description so it renders as inert text", () => {
    const markup = renderToStaticMarkup(
      <InvoiceLineItems
        currency="USD"
        lineItems={[
          {
            id: "li_1",
            invoiceId: "inv_1",
            description: '<img src=x onerror="alert(document.cookie)">',
            quantity: 1,
            unitAmountCents: 1000,
            amountCents: 1000,
            refunded: false,
            bookingId: null,
          },
        ]}
      />,
    );

    // The malicious markup must appear escaped, never as a live element/handler.
    expect(markup).toContain("&lt;img");
    expect(markup).not.toContain("<img");
  });

  it("renders an ordinary description as readable text", () => {
    const markup = renderToStaticMarkup(
      <InvoiceLineItems
        currency="USD"
        lineItems={[
          {
            id: "li_1",
            invoiceId: "inv_1",
            description: "10-class pass",
            quantity: 1,
            unitAmountCents: 1500,
            amountCents: 1500,
            refunded: false,
            bookingId: null,
          },
        ]}
      />,
    );

    expect(markup).toContain("10-class pass");
  });
});
