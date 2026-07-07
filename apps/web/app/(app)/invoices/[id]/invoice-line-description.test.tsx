import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InvoiceLineDescription } from "./invoice-line-description";

describe("InvoiceLineDescription", () => {
  it("escapes HTML in the description so it renders as inert text", () => {
    const payload = `<img src=x onerror="alert(document.cookie)">`;
    const html = renderToStaticMarkup(<InvoiceLineDescription text={payload} />);

    // The markup must appear verbatim as escaped text...
    expect(html).toContain("&lt;img");
    // ...and must never produce a real <img> element (which would carry the
    // handler). The payload's "onerror=" only ever survives as visible text
    // inside the span, never as an attribute on a real element.
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<img ");
    expect(html).toBe(
      `<span>&lt;img src=x onerror=&quot;alert(document.cookie)&quot;&gt;</span>`,
    );
  });

  it("renders ordinary plain-text descriptions verbatim and readably", () => {
    const text = "Single session — 60 minutes";
    const html = renderToStaticMarkup(<InvoiceLineDescription text={text} />);

    expect(html).toContain(text);
  });
});
