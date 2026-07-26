import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LineItemDescription } from "./line-item-description";

describe("LineItemDescription", () => {
  it("escapes HTML markup instead of rendering it", () => {
    const payload = '<img src=x onerror="alert(document.cookie)">';
    const html = renderToStaticMarkup(<LineItemDescription description={payload} />);

    expect(html).toContain("&lt;img");
    expect(html).toContain("&gt;");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('onerror="alert');
  });

  it("renders ordinary text readably", () => {
    const html = renderToStaticMarkup(
      <LineItemDescription description="Studio rental - 2 hours" />,
    );

    expect(html).toContain("Studio rental - 2 hours");
  });
});
