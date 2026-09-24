import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { DayView, DAY_VIEW_EMPTY_MESSAGE } from "./day-view";

describe("DayView", () => {
  it("renders empty state when hasEntries is false", () => {
    const html = renderToStaticMarkup(
      React.createElement(DayView, { hasEntries: false, children: null }),
    );
    expect(html).toContain(DAY_VIEW_EMPTY_MESSAGE);
  });

  it("renders children when hasEntries is true", () => {
    const html = renderToStaticMarkup(
      React.createElement(DayView, { hasEntries: true }, "Test content"),
    );
    expect(html).toContain("Test content");
    expect(html).not.toContain(DAY_VIEW_EMPTY_MESSAGE);
  });
});
