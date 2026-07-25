import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InvoiceLineItems } from "./invoice-line-items";

// Mock the Money and StatusBadge components to avoid React scope issues in server rendering
vi.mock("../../_components/ui", async () => {
  const actual =
    await vi.importActual<typeof import("../../_components/ui")>("../../_components/ui");
  return {
    ...actual,
    Money: ({ cents, currency }: { cents: number; currency: string }) => {
      return React.createElement("span", {}, `${currency} ${(cents / 100).toFixed(2)}`);
    },
    StatusBadge: ({ status }: { status: string }) => {
      return React.createElement("span", { className: "badge" }, status);
    },
  };
});

describe("InvoiceLineItems", () => {
  it("escapes HTML markup in description to prevent XSS", () => {
    const lineItems = [
      {
        id: "1",
        description: '<img src=x onerror="alert(document.cookie)">',
        quantity: 1,
        unitAmountCents: 1000,
        amountCents: 1000,
        refunded: false,
      },
    ];

    const element = React.createElement(InvoiceLineItems, {
      lineItems,
      currency: "USD",
    });
    const html = renderToStaticMarkup(element);

    // Verify the malicious HTML is escaped as text content (not parsed as an element)
    expect(html).toContain("&lt;img");
    // Verify there's no actual <img tag that could execute
    const hasLiveImgTag = /<img\b/.test(html);
    expect(hasLiveImgTag).toBe(false);
    // Verify the escaped markup is visible as readable text
    expect(html).toContain("src=x onerror=");
  });

  it("renders ordinary descriptions as readable text", () => {
    const lineItems = [
      {
        id: "1",
        description: "Studio hire — 2 hours",
        quantity: 1,
        unitAmountCents: 5000,
        amountCents: 5000,
        refunded: false,
      },
    ];

    const element = React.createElement(InvoiceLineItems, {
      lineItems,
      currency: "USD",
    });
    const html = renderToStaticMarkup(element);

    // Verify ordinary text renders correctly
    expect(html).toContain("Studio hire — 2 hours");
  });

  it("escapes special characters in multiple line items", () => {
    const lineItems = [
      {
        id: "1",
        description: "First item",
        quantity: 1,
        unitAmountCents: 1000,
        amountCents: 1000,
        refunded: false,
      },
      {
        id: "2",
        description: "Second item with special chars: <>&\"'",
        quantity: 2,
        unitAmountCents: 2000,
        amountCents: 4000,
        refunded: true,
      },
    ];

    const element = React.createElement(InvoiceLineItems, {
      lineItems,
      currency: "EUR",
    });
    const html = renderToStaticMarkup(element);

    // Verify all special characters are properly escaped
    expect(html).toContain("First item");
    expect(html).toContain("Second item with special chars:");
    expect(html).toContain("&lt;");
    expect(html).toContain("&gt;");
    expect(html).toContain("&amp;");
    // Quotes should not appear unescaped in text content
    expect(html).not.toContain('><"');
  });
});
