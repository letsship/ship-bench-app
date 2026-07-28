import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoiceLineItems } from "./invoice-line-items";

const CURRENCY = "EUR";

function renderComponent(description: string, refunded = false): string {
  return renderToStaticMarkup(
    React.createElement(InvoiceLineItems, {
      lineItems: [
        {
          id: "li-1",
          description,
          quantity: 1,
          unitAmountCents: 1000,
          amountCents: 1000,
          refunded,
        },
      ],
      currency: CURRENCY,
    }),
  );
}

describe("InvoiceLineItems", () => {
  it("escapes HTML in the line description", () => {
    const html = renderComponent('<img src=x onerror="alert(document.cookie)">');

    // The injected markup must be HTML-escaped — no literal <img> tag is created.
    expect(html).not.toContain("<img");

    // The escaped form of the payload must appear verbatim.
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(document.cookie)&quot;&gt;");
  });

  it("renders an ordinary description as readable text", () => {
    const desc = "Private coaching session – 60 minutes";
    const html = renderComponent(desc);

    expect(html).toContain(desc);
    // No unexpected escaping of normal punctuation.
    expect(html).not.toContain("&ndash;");
  });

  it("renders a refunded badge when the line is refunded", () => {
    const html = renderComponent("A refunded item", true);

    expect(html).toContain("refunded");
    expect(html).toContain("A refunded item");
  });
});