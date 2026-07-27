import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvoiceLineDescription } from "./invoice-line-description";

function render(description: string) {
  return renderToStaticMarkup(createElement(InvoiceLineDescription, { description }));
}

describe("InvoiceLineDescription", () => {
  it("renders HTML markup as inert, escaped text", () => {
    const markup = render("<img src=x onerror=alert(1)>");

    expect(markup).not.toContain("<img");
    expect(markup).not.toMatch(/<img\b[^>]*onerror=/);
    expect(markup).toContain("&lt;img");
  });

  it("renders an ordinary description verbatim", () => {
    const markup = render("Reformer 5-pack");

    expect(markup).toContain("Reformer 5-pack");
  });
});
