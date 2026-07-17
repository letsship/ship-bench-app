import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { INVOICES_EMPTY_STATE_MESSAGE, InvoicesList } from "./invoices-list";

describe("InvoicesList", () => {
  it("renders the empty state when there are no invoices", () => {
    const markup = renderToStaticMarkup(
      createElement(InvoicesList, { invoices: [], timezone: "UTC" }),
    );

    expect(markup).toContain(INVOICES_EMPTY_STATE_MESSAGE);
    expect(markup).not.toContain('data-testid="invoices-table"');
  });

  it("renders the table when invoices exist", () => {
    const markup = renderToStaticMarkup(
      createElement(InvoicesList, {
        invoices: [
          {
            id: "inv_1",
            number: "INV-0001",
            memberName: "Jane Doe",
            status: "paid",
            issuedAt: "2026-01-01T00:00:00.000Z",
            totalCents: 1000,
            currency: "USD",
          },
        ],
        timezone: "UTC",
      }),
    );

    expect(markup).toContain('data-testid="invoices-table"');
    expect(markup).not.toContain(INVOICES_EMPTY_STATE_MESSAGE);
  });
});
