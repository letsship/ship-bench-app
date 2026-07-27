import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LineItemDescription } from "./line-item-description";

describe("LineItemDescription", () => {
  it("renders HTML in the description as inert, escaped text", () => {
    const malicious = '<img src=x onerror="alert(document.cookie)">';
    const markup = renderToStaticMarkup(
      <LineItemDescription description={malicious} refunded={false} />,
    );

    expect(markup).toContain("&lt;img");
    expect(markup).not.toContain("<img");
    expect(markup).not.toMatch(/<[a-z]+[^>]*\bonerror\s*=/i);
  });

  it("renders an ordinary description as readable text", () => {
    const markup = renderToStaticMarkup(
      <LineItemDescription description="Reformer 5-pack" refunded={false} />,
    );

    expect(markup).toContain("Reformer 5-pack");
  });
});
