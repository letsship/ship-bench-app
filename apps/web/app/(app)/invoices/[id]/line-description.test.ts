import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { LineDescription } from "./line-description";

describe("LineDescription", () => {
  it("escapes HTML markup in descriptions", () => {
    const xssPayload = '<img src=x onerror="alert(document.cookie)">';
    const html = renderToStaticMarkup(
      React.createElement(LineDescription, { description: xssPayload }),
    );

    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
  });

  it("renders plain text descriptions unchanged", () => {
    const plainText = "Drop-in class x10";
    const html = renderToStaticMarkup(
      React.createElement(LineDescription, { description: plainText }),
    );

    expect(html).toContain(plainText);
  });

  it("page.tsx does not use dangerouslySetInnerHTML", () => {
    const pageFilePath = resolve(__dirname, "page.tsx");
    const pageContent = readFileSync(pageFilePath, "utf-8");

    expect(pageContent).not.toContain("dangerouslySetInnerHTML");
  });
});
