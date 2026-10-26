import { describe, expect, it } from "vitest";
import { formatBookingCount } from "./format";

describe("formatBookingCount", () => {
  it("uses the singular form for one booking", () => {
    expect(formatBookingCount(1)).toBe("(1 booking)");
  });

  it("uses the plural form for two bookings", () => {
    expect(formatBookingCount(2)).toBe("(2 bookings)");
  });

  it("uses the plural form for five bookings", () => {
    expect(formatBookingCount(5)).toBe("(5 bookings)");
  });
});
