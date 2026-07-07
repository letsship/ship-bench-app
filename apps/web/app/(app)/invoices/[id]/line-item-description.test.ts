import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LineItemDescription } from "./line-item-description";

describe("LineItemDescription", () => {
  it("escapes HTML in the description", () => {
    const payload = '<img src=x onerror="alert(document.cookie)">';
    const markup = renderToStaticMarkup(
      LineItemDescription({ description: payload }),
    );
    expect(markup).toContain("&lt;img");
    expect(markup).not.toContain("<img");
    expect(markup).toBe("&lt;img src=x onerror=&quot;alert(document.cookie)&quot;&gt;");
  });

  it("renders ordinary descriptions unchanged", () => {
    const markup = renderToStaticMarkup(
      LineItemDescription({ description: "Monthly studio membership" }),
    );
    expect(markup).toContain("Monthly studio membership");
  });
});
