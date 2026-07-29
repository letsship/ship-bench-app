import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LineItemDescription } from "./line-item-description";

describe("LineItemDescription", () => {
  it("escapes HTML in the description so no element or handler is created", () => {
    const markup = renderToStaticMarkup(
      createElement(LineItemDescription, {
        description: '<img src=x onerror="alert(document.cookie)">',
      }),
    );

    expect(markup).toContain("&lt;img");
    expect(markup).toContain("&gt;");
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain("<script");
  });

  it("renders an ordinary description as readable text", () => {
    const markup = renderToStaticMarkup(
      createElement(LineItemDescription, { description: "Studio hire - 2 hours" }),
    );

    expect(markup).toContain("Studio hire - 2 hours");
  });
});
