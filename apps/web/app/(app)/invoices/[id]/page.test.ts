import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("invoice detail page source guard", () => {
  it("renders line descriptions as escaped text, not raw HTML", () => {
    const source = readFileSync(resolve(__dirname, "page.tsx"), "utf8");

    expect(source).not.toContain("dangerouslySetInnerHTML");
    expect(source).toContain("{line.description}");
  });
});
