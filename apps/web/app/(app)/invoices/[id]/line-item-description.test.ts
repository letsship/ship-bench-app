import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LineItemDescription } from "./line-item-description";

describe("LineItemDescription", () => {
  it("renders HTML markup as inert escaped text", () => {
    const value = '<img src=x onerror="alert(document.cookie)">';
    const markup = renderToStaticMarkup(React.createElement(LineItemDescription, { value }));

    expect(markup).toContain("&lt;img");
    expect(markup).toContain("&gt;");
    expect(markup).not.toContain("<img");
    expect(markup).not.toMatch(/<[^>]*\sonerror=/i);
  });

  it("renders ordinary descriptions as readable text", () => {
    const value = "Studio hire - 2 hours";
    const markup = renderToStaticMarkup(React.createElement(LineItemDescription, { value }));

    expect(markup).toBe(value);
  });
});
