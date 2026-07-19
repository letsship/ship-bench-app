import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { LineItemDescription } from "./line-item-description";

describe("LineItemDescription", () => {
  it("escapes HTML in malicious payloads", () => {
    const maliciousPayload = '<img src=x onerror="alert(document.cookie)">';
    const html = renderToStaticMarkup(
      React.createElement(LineItemDescription, { text: maliciousPayload }),
    );

    // The payload should be escaped and rendered as text, not as an actual HTML element
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img src=x");
  });

  it("renders ordinary descriptions as readable text", () => {
    const ordinaryDescription = "Studio rental - 2h";
    const html = renderToStaticMarkup(
      React.createElement(LineItemDescription, { text: ordinaryDescription }),
    );

    expect(html).toContain(ordinaryDescription);
  });
});
