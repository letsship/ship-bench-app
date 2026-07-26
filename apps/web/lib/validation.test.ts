import { describe, expect, it } from "vitest";
import { createClassTypeSchema, createMemberSchema, updateMemberSchema } from "./validation";

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    const result = createMemberSchema.safeParse({ name: "Ada", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("trims and lower-cases a valid email", () => {
    const result = createMemberSchema.safeParse({
      name: "Ada",
      email: "  Ada@Example.COM  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ada@example.com");
    }
  });

  it("defaults status to active when omitted", () => {
    const result = createMemberSchema.safeParse({ name: "Ada", email: "ada@example.com" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
    }
  });
});

describe("updateMemberSchema", () => {
  it("trims and lower-cases a valid email", () => {
    const result = updateMemberSchema.safeParse({ email: "  Bea@Example.COM  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("bea@example.com");
    }
  });

  it("rejects a malformed email", () => {
    const result = updateMemberSchema.safeParse({ email: "nope" });
    expect(result.success).toBe(false);
  });
});

describe("createClassTypeSchema color", () => {
  it("rejects a color that is not #rrggbb hex", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      color: "red",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid #rrggbb hex color", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      color: "#1a2b3c",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
    });
    expect(result.success).toBe(true);
  });
});
