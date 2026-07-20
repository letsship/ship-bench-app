import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { LineItemDescription } from "./line-item-description";

describe("LineItemDescription", () => {
  it("escapes HTML markup in XSS payload", () => {
    const xssPayload = '<img src=x onerror="alert(document.cookie)">';
    const html = renderToStaticMarkup(
      createElement(LineItemDescription, { description: xssPayload }),
    );

    // Assert the markup is escaped (no live <img element, no unescaped onerror= attribute)
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('onerror="');
  });

  it("renders ordinary descriptions verbatim", () => {
    const description = "Widget assembly service";
    const html = renderToStaticMarkup(createElement(LineItemDescription, { description }));

    expect(html).toContain(description);
  });
});
