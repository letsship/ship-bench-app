import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvoiceLineDescription } from "./line-item-description";

describe("InvoiceLineDescription", () => {
  it("escapes HTML markup in the description to prevent XSS", () => {
    const xssPayload = '<img src=x onerror="alert(document.cookie)">';
    const element = React.createElement(InvoiceLineDescription, {
      description: xssPayload,
      refunded: false,
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("&lt;img");
    expect(html).toContain("onerror");
    expect(html).not.toContain("<img src=x onerror=");
  });

  it("preserves ordinary descriptions as readable text", () => {
    const ordinaryDescription = "Studio hire - 2 hrs";
    const element = React.createElement(InvoiceLineDescription, {
      description: ordinaryDescription,
      refunded: false,
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Studio hire - 2 hrs");
  });

  it("renders the refunded badge when refunded is true", () => {
    const element = React.createElement(InvoiceLineDescription, {
      description: "Some service",
      refunded: true,
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("refunded");
  });
});
