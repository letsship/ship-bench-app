// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { InvoiceLineItem } from "@/lib/db/types";
import { InvoiceLineItemsTable } from "./invoice-line-items-table";

afterEach(() => {
  cleanup();
});

function makeLineItem(overrides: Partial<InvoiceLineItem>): InvoiceLineItem {
  return {
    id: "line-1",
    invoiceId: "invoice-1",
    description: "Session",
    quantity: 1,
    unitAmountCents: 1000,
    amountCents: 1000,
    refunded: false,
    bookingId: null,
    ...overrides,
  };
}

describe("InvoiceLineItemsTable", () => {
  it("renders an HTML payload in the description as inert text, not markup", () => {
    const payload = '<img src=x onerror="alert(document.cookie)">';
    const { container } = render(
      <InvoiceLineItemsTable
        lineItems={[makeLineItem({ id: "line-xss", description: payload })]}
        currency="USD"
      />,
    );

    expect(screen.getByText(payload).textContent).toBe(payload);
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders an ordinary description as readable text", () => {
    render(
      <InvoiceLineItemsTable
        lineItems={[makeLineItem({ id: "line-normal", description: "1-hour rehearsal room" })]}
        currency="USD"
      />,
    );

    expect(screen.getByText("1-hour rehearsal room").textContent).toBe("1-hour rehearsal room");
  });
});
