import { describe, expect, it } from "vitest";
import { createClassTypeSchema, createMemberSchema } from "./validation";

// Pins the request-validator behaviour across the Zod 4 upgrade: a malformed
// email is rejected; a valid padded/mixed-case email is trimmed + lower-cased;
// a new member's status defaults to "active"; and a non-#rrggbb colour is
// rejected while a valid hex passes.

describe("createMemberSchema email handling", () => {
  it("rejects a malformed email", () => {
    const result = createMemberSchema.safeParse({ name: "Ada", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("trims and lower-cases a valid padded/mixed-case email", () => {
    const result = createMemberSchema.parse({ name: "Ada", email: "  Foo@BAR.com " });
    expect(result.email).toBe("foo@bar.com");
  });

  it('defaults status to "active" when omitted', () => {
    const result = createMemberSchema.parse({ name: "Ada", email: "ada@example.com" });
    expect(result.status).toBe("active");
  });

  it("accepts an explicit status and preserves it", () => {
    const result = createMemberSchema.parse({
      name: "Ada",
      email: "ada@example.com",
      status: "paused",
    });
    expect(result.status).toBe("paused");
  });
});

describe("createClassTypeSchema color handling", () => {
  const base = { name: "Yoga", defaultCapacity: 10, defaultPriceCents: 1000 };

  it("rejects a colour that is not a #rrggbb hex value", () => {
    const result = createClassTypeSchema.safeParse({ ...base, color: "red" });
    expect(result.success).toBe(false);
  });

  it("rejects a short hex value", () => {
    const result = createClassTypeSchema.safeParse({ ...base, color: "#fff" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid #rrggbb hex value", () => {
    const result = createClassTypeSchema.parse({ ...base, color: "#1A2B3C" });
    expect(result.color).toBe("#1A2B3C");
  });

  it("treats color as optional", () => {
    const result = createClassTypeSchema.parse(base);
    expect(result.color).toBeUndefined();
  });
});
