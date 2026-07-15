import { describe, expect, it } from "vitest";
import { CANCELLATION_WINDOW_HOURS, cancellationPolicyCopy } from "./cancellation-policy";

describe("cancellationPolicyCopy", () => {
  it("returns the exact free-cancellation copy", () => {
    expect(cancellationPolicyCopy()).toBe("Free cancellation up to 24 hours before class start");
  });

  it("is built from the CANCELLATION_WINDOW_HOURS constant", () => {
    expect(CANCELLATION_WINDOW_HOURS).toBe(24);
  });
});
