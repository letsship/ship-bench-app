import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LineDescription } from "./line-description";

describe("LineDescription", () => {
  it("escapes HTML img tags with onerror handler", () => {
    const xssPayload = '<img src=x onerror="alert(document.cookie)">';
    const html = renderToStaticMarkup(createElement(LineDescription, { description: xssPayload }));
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
  });

  it("escapes script tags", () => {
    const scriptPayload = "<script>alert(1)</script>";
    const html = renderToStaticMarkup(
      createElement(LineDescription, { description: scriptPayload }),
    );
    expect(html).not.toContain("<script");
  });

  it("renders ordinary text verbatim", () => {
    const ordinaryText = "Drop-in class (60 min)";
    const html = renderToStaticMarkup(
      createElement(LineDescription, { description: ordinaryText }),
    );
    expect(html).toContain("Drop-in class (60 min)");
  });
});
