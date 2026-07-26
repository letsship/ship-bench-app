import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LineItemDescription } from "./line-item-description";

describe("LineItemDescription", () => {
  it("escapes HTML so it renders as inert text", () => {
    const malicious = '<img src=x onerror="alert(document.cookie)">';
    const html = renderToStaticMarkup(
      createElement(LineItemDescription, { description: malicious }),
    );

    expect(html).toContain("&lt;img");
    expect(html).toContain("&quot;alert(document.cookie)&quot;");
    expect(html).not.toContain("<img");
    expect(html).not.toMatch(/<[a-z]/i);
  });

  it("renders ordinary descriptions verbatim", () => {
    const html = renderToStaticMarkup(
      createElement(LineItemDescription, { description: "Studio hire - 2 hours" }),
    );

    expect(html).toContain("Studio hire - 2 hours");
  });
});
