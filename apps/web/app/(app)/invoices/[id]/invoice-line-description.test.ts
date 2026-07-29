import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoiceLineDescription } from "./invoice-line-description";

describe("InvoiceLineDescription", () => {
  it("escapes HTML in malicious descriptions", () => {
    const malicious = `<img src=x onerror="alert(document.cookie)">`;
    const output = renderToStaticMarkup(
      React.createElement(InvoiceLineDescription, { description: malicious }),
    );
    expect(output).not.toContain("<img");
    expect(output).not.toContain('onerror="');
    expect(output).toContain("&lt;img");
    expect(output).toContain("&gt;");
  });

  it("renders ordinary descriptions as readable text", () => {
    const ordinary = "Studio time — 2 hrs";
    const output = renderToStaticMarkup(
      React.createElement(InvoiceLineDescription, { description: ordinary }),
    );
    expect(output).toContain(ordinary);
  });
});