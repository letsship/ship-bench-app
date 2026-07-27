import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LineItemDescription } from "./line-item-description";

describe("LineItemDescription", () => {
  it("renders HTML in the description as inert, escaped text", () => {
    const payload = `<img src=x onerror="alert(document.cookie)">`;
    const html = renderToStaticMarkup(React.createElement(LineItemDescription, { value: payload }));

    expect(html).toContain("&lt;img src=x onerror=&quot;alert(document.cookie)&quot;&gt;");
    expect(html).not.toContain("<img");
    expect(html).not.toMatch(/<[^>]+\bonerror\s*=/);
  });

  it("renders ordinary descriptions as readable text", () => {
    const html = renderToStaticMarkup(
      React.createElement(LineItemDescription, { value: "10-class pass" }),
    );

    expect(html).toContain("10-class pass");
  });
});
