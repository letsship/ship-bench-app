import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LineItemDescription } from "./line-item-description";

describe("LineItemDescription", () => {
  it("renders malicious markup as inert escaped text", () => {
    const payload = '<img src=x onerror="alert(document.cookie)">';
    const html = renderToStaticMarkup(
      React.createElement(LineItemDescription, { description: payload }),
    );

    // The only "<" and ">" in the output must be the wrapping <span> tags themselves —
    // the payload's own angle brackets and quotes must come through fully escaped, proving
    // no <img> element or onerror handler is ever created from it.
    expect(html).toBe("<span>&lt;img src=x onerror=&quot;alert(document.cookie)&quot;&gt;</span>");
  });

  it("renders an ordinary description as readable text", () => {
    const html = renderToStaticMarkup(
      React.createElement(LineItemDescription, { description: "Private lesson - 60 min" }),
    );

    expect(html).toContain("Private lesson - 60 min");
  });
});
