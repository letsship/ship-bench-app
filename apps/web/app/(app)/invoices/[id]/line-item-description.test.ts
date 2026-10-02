import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { LineItemDescription } from "./line-item-description";

describe("LineItemDescription", () => {
  it("escapes XSS payload and prevents script execution", () => {
    const xssPayload = '<img src=x onerror="alert(document.cookie)">';
    const html = renderToStaticMarkup(
      createElement(LineItemDescription, { description: xssPayload }),
    );

    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('onerror="');
  });

  it("renders plain text descriptions unchanged", () => {
    const plainText = "10-class pass";
    const html = renderToStaticMarkup(
      createElement(LineItemDescription, { description: plainText }),
    );

    expect(html).toContain(plainText);
  });
});
