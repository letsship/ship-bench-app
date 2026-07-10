import { describe, expect, it } from "vitest";
import { createClassTypeSchema, createMemberSchema } from "./validation";

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    const result = createMemberSchema.safeParse({
      name: "Ada Lovelace",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("trims and lower-cases a valid but messy email", () => {
    const result = createMemberSchema.safeParse({
      name: "Ada Lovelace",
      email: "  Ada@Example.COM  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ada@example.com");
    }
  });

  it("defaults status to active when omitted", () => {
    const result = createMemberSchema.safeParse({
      name: "Ada Lovelace",
      email: "ada@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
    }
  });
});

describe("createClassTypeSchema", () => {
  it("rejects a color that is not #rrggbb hex", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      color: "blue",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid #rrggbb hex color", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      color: "#a1b2c3",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
    });
    expect(result.success).toBe(true);
  });
});
