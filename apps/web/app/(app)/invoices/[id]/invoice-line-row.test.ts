import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { InvoiceLineItem } from "@/lib/db/types";
import { InvoiceLineRow } from "./invoice-line-row";

function renderRow(description: string) {
  const line: InvoiceLineItem = {
    id: "line_1",
    invoiceId: "invoice_1",
    description,
    quantity: 1,
    unitAmountCents: 1000,
    amountCents: 1000,
    refunded: false,
    bookingId: null,
  };

  return renderToStaticMarkup(
    React.createElement(
      "table",
      null,
      React.createElement(
        "tbody",
        null,
        React.createElement(InvoiceLineRow, { line, currency: "usd" }),
      ),
    ),
  );
}

describe("InvoiceLineRow", () => {
  it("renders a malicious description as inert, escaped text", () => {
    const html = renderRow('<img src=x onerror="alert(document.cookie)">');

    expect(html).toContain("&lt;img src=x onerror=");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('onerror="alert');
  });

  it("renders an ordinary description as readable text", () => {
    const html = renderRow("2 hours studio time");

    expect(html).toContain("2 hours studio time");
  });
});
