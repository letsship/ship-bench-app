import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LineItemDescription } from "./LineItemDescription";

describe("LineItemDescription", () => {
  it("renders HTML markup as inert escaped text", () => {
    const markup = renderToStaticMarkup(
      <LineItemDescription description={'<img src=x onerror="alert(1)">' } />,
    );

    expect(markup).toContain("&lt;img");
    expect(markup).not.toContain("<img");
    expect(markup).not.toContain(" onerror=");
  });

  it("renders ordinary descriptions as readable text", () => {
    const markup = renderToStaticMarkup(
      <LineItemDescription description="Studio time - 2 hours" />,
    );

    expect(markup).toContain("Studio time - 2 hours");
  });
});
