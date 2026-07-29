import { describe, it, expect } from "vitest";
import { createMemberSchema, updateMemberSchema, createClassTypeSchema } from "./validation";

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    const result = createMemberSchema.safeParse({
      name: "Alice",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/email/i);
    }
  });

  it("trims and lower-cases a valid email", () => {
    const result = createMemberSchema.parse({
      name: "Alice",
      email: "  Alice@Example.COM  ",
    });
    expect(result.email).toBe("alice@example.com");
  });

  it("defaults status to active when omitted", () => {
    const result = createMemberSchema.parse({
      name: "Alice",
      email: "alice@example.com",
    });
    expect(result.status).toBe("active");
  });
});

describe("updateMemberSchema", () => {
  it("trims and lower-cases a valid email", () => {
    const result = updateMemberSchema.parse({
      email: "  Bob@Example.ORG  ",
    });
    expect(result.email).toBe("bob@example.org");
  });

  it("accepts omitted email", () => {
    const result = updateMemberSchema.parse({});
    expect(result.email).toBeUndefined();
  });
});

describe("createClassTypeSchema", () => {
  it("rejects a color that is not a #rrggbb hex value", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      color: "red",
      defaultCapacity: 10,
      defaultPriceCents: 1500,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid #rrggbb hex color", () => {
    const result = createClassTypeSchema.parse({
      name: "Yoga",
      color: "#FF5733",
      defaultCapacity: 10,
      defaultPriceCents: 1500,
    });
    expect(result.color).toBe("#FF5733");
  });
});