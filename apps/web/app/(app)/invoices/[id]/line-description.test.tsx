import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InvoiceLineDescription } from "./line-description";

describe("InvoiceLineDescription", () => {
  it("escapes HTML in the description instead of creating elements", () => {
    const html = renderToStaticMarkup(
      <InvoiceLineDescription description='<img src=x onerror="alert(document.cookie)">' refunded={false} />,
    );

    expect(html).toBe("&lt;img src=x onerror=&quot;alert(document.cookie)&quot;&gt;");
    expect(html).not.toContain("<img");
  });

  it("renders an ordinary description verbatim", () => {
    const html = renderToStaticMarkup(
      <InvoiceLineDescription description="Studio hire - March" refunded={false} />,
    );

    expect(html).toContain("Studio hire - March");
  });

  it("shows the refunded badge when the line is refunded", () => {
    const html = renderToStaticMarkup(
      <InvoiceLineDescription description="Studio hire - March" refunded={true} />,
    );

    expect(html.toLowerCase()).toContain("refunded");
  });
});
