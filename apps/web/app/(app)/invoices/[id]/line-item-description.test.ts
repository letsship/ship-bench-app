import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { LineItemDescription } from "./line-item-description";

describe("LineItemDescription", () => {
  it("escapes HTML markup in the description", () => {
    const xssPayload = '<img src=x onerror="alert(document.cookie)">';
    const element = React.createElement(LineItemDescription, { description: xssPayload });
    const rendered = renderToStaticMarkup(element);

    expect(rendered).toContain("&lt;img");
    expect(rendered).not.toContain("<img");
  });

  it("renders ordinary descriptions verbatim", () => {
    const description = "Monthly membership";
    const element = React.createElement(LineItemDescription, { description });
    const rendered = renderToStaticMarkup(element);

    expect(rendered).toContain("Monthly membership");
  });
});
