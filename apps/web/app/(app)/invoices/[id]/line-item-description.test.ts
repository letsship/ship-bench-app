import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { LineItemDescription } from "./line-item-description";

describe("LineItemDescription", () => {
  it("escapes HTML markup in description", () => {
    const payload = '<img src=x onerror="alert(document.cookie)">';
    const rendered = renderToStaticMarkup(createElement(LineItemDescription, { value: payload }));

    expect(rendered).toContain("&lt;img");
    expect(rendered).toContain("&gt;");
    expect(rendered).not.toContain("<img");
    // The entire thing is escaped, so we should see the escaped entities
    expect(rendered).toContain("&lt;img src=x onerror=&quot;");
  });

  it("renders ordinary text verbatim", () => {
    const description = "Reformer 5-pack";
    const rendered = renderToStaticMarkup(
      createElement(LineItemDescription, { value: description }),
    );

    expect(rendered).toContain("Reformer 5-pack");
  });
});
