import { describe, expect, it } from "vitest";
import { formatMoney, parseAmountToCents, sumCents } from "./money";

describe("formatMoney", () => {
  it("formats euros", () => {
    expect(formatMoney(1234, "EUR", "en-US")).toBe("€12.34");
  });

  it("formats US dollars", () => {
    expect(formatMoney(1000, "USD", "en-US")).toBe("$10.00");
  });

  it("formats zero", () => {
    expect(formatMoney(0, "EUR", "en-US")).toBe("€0.00");
  });
});

describe("sumCents", () => {
  it("adds a list of cent amounts", () => {
    expect(sumCents([100, 200, 50])).toBe(350);
  });

  it("is zero for an empty list", () => {
    expect(sumCents([])).toBe(0);
  });
});

describe("parseAmountToCents", () => {
  it("parses a plain amount", () => {
    expect(parseAmountToCents("12.50")).toBe(1250);
  });

  it("strips currency symbols and thousands separators", () => {
    expect(parseAmountToCents("€1,234.56")).toBe(123456);
  });

  it("parses whole numbers", () => {
    expect(parseAmountToCents("5")).toBe(500);
  });

  it("parses negative amounts", () => {
    expect(parseAmountToCents("-5")).toBe(-500);
  });

  it("throws on non-numeric input", () => {
    expect(() => parseAmountToCents("abc")).toThrow(RangeError);
  });

  it("throws on an empty string", () => {
    expect(() => parseAmountToCents("")).toThrow(RangeError);
  });

  it("throws on a malformed number", () => {
    expect(() => parseAmountToCents("12.3.4")).toThrow(RangeError);
  });
});
