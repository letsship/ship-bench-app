import { describe, expect, it } from "vitest";
import { UniqueViolationError, isUniqueViolation } from "./errors";

describe("UniqueViolationError", () => {
  it("creates an error with a message", () => {
    const err = new UniqueViolationError("test error");
    expect(err.message).toBe("test error");
    expect(err.name).toBe("UniqueViolationError");
  });

  it("optionally stores a constraint name", () => {
    const err = new UniqueViolationError("test error", "idx_bookings_unique_active");
    expect(err.constraintName).toBe("idx_bookings_unique_active");
  });

  it("isUniqueViolation returns true for UniqueViolationError instances", () => {
    const err = new UniqueViolationError("test");
    expect(isUniqueViolation(err)).toBe(true);
  });

  it("isUniqueViolation returns false for regular errors", () => {
    const err = new Error("test");
    expect(isUniqueViolation(err)).toBe(false);
  });

  it("isUniqueViolation returns false for non-errors", () => {
    expect(isUniqueViolation("string")).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation({})).toBe(false);
  });
});
