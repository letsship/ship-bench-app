import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LineItemDescription } from "./line-item-description";

describe("LineItemDescription", () => {
  it("escapes img onerror payloads", () => {
    const description = '<img src=x onerror="alert(document.cookie)">';
    const html = renderToStaticMarkup(createElement(LineItemDescription, { description }));
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
  });

  it("escapes script payloads", () => {
    const description = "<script>alert('xss')</script>";
    const html = renderToStaticMarkup(createElement(LineItemDescription, { description }));
    expect(html).toContain("&lt;script");
    expect(html).not.toContain("<script");
  });

  it("renders plain text unchanged", () => {
    const description = "Reformer 5-pack";
    const html = renderToStaticMarkup(createElement(LineItemDescription, { description }));
    expect(html).toContain(description);
  });
});
