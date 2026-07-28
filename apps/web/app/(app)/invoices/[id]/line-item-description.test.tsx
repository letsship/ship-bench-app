import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LineItemDescription } from "./line-item-description";

describe("LineItemDescription", () => {
  it("renders HTML payloads as escaped, inert text", () => {
    const payload = `<img src=x onerror="alert(document.cookie)">`;
    const output = renderToStaticMarkup(<LineItemDescription value={payload} />);

    // The payload must appear verbatim, escaped — never parsed into an element.
    expect(output).toContain("&lt;img");
    expect(output).not.toContain("<img");
    expect(output).not.toContain('onerror="');
    expect(output).not.toContain("onerror='");
  });

  it("renders ordinary descriptions verbatim as readable text", () => {
    const output = renderToStaticMarkup(
      <LineItemDescription value="Private piano lesson (60 min)" />,
    );
    expect(output).toBe("Private piano lesson (60 min)");
  });
});
