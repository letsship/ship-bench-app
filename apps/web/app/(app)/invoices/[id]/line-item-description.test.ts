import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LineItemDescription } from "./line-item-description";

function renderCell(description: string, refunded = false): string {
  return renderToStaticMarkup(createElement(LineItemDescription, { description, refunded }));
}

describe("LineItemDescription", () => {
  it("escapes stored HTML so no element or handler is created", () => {
    const html = renderCell('<img src=x onerror="alert(1)">');

    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('onerror="');
  });

  it("renders ordinary descriptions as readable text", () => {
    expect(renderCell("Studio hire - 2 hours")).toContain("Studio hire - 2 hours");
  });

  it("shows the refunded badge only for refunded lines", () => {
    expect(renderCell("Studio hire", true)).toContain("sb-badge");
    expect(renderCell("Studio hire")).not.toContain("sb-badge");
  });
});
