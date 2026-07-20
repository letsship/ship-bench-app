import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LineItemDescription } from "./line-item-description";

describe("LineItemDescription", () => {
  it("escapes HTML in descriptions", () => {
    const maliciousDescription = '<img src=x onerror="alert(document.cookie)">';
    const html = renderToStaticMarkup(LineItemDescription({ description: maliciousDescription }));

    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('onerror="');
  });

  it("renders ordinary descriptions as readable text", () => {
    const ordinaryDescription = "Studio rental - 2 hours";
    const html = renderToStaticMarkup(LineItemDescription({ description: ordinaryDescription }));

    expect(html).toContain("Studio rental - 2 hours");
  });
});
