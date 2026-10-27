import { describe, expect, it } from "vitest";
import { invoiceStatusFilterSchema, updateInvoiceStatusSchema } from "./validation";

describe("invoiceStatusFilterSchema", () => {
  it("keeps a known invoice status", () => {
    expect(invoiceStatusFilterSchema.parse("open")).toBe("open");
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["all", "all"],
    ["an unknown status", "bogus"],
    ["an array value", ["open", "paid"]],
  ])("maps %s to null (All)", (_label, value) => {
    expect(invoiceStatusFilterSchema.parse(value)).toBeNull();
  });
});

describe("updateInvoiceStatusSchema", () => {
  it("accepts every invoice status", () => {
    for (const status of ["draft", "open", "paid", "void", "refunded"]) {
      expect(updateInvoiceStatusSchema.parse({ status })).toEqual({ status });
    }
  });

  it("rejects an unknown status", () => {
    expect(updateInvoiceStatusSchema.safeParse({ status: "bogus" }).success).toBe(false);
  });
});
