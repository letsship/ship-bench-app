import { describe, expect, it } from "vitest";
import { createClassTypeSchema, createMemberSchema } from "./validation";

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    const result = createMemberSchema.safeParse({ name: "Ada", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("trims and lower-cases a valid email", () => {
    const result = createMemberSchema.parse({ name: "Ada", email: "  Ada@Example.COM  " });
    expect(result.email).toBe("ada@example.com");
  });

  it("defaults status to active when omitted", () => {
    const result = createMemberSchema.parse({ name: "Ada", email: "ada@example.com" });
    expect(result.status).toBe("active");
  });
});

describe("createClassTypeSchema", () => {
  const base = {
    name: "Yoga",
    defaultCapacity: 20,
    defaultPriceCents: 1500,
  };

  it("rejects a color that is not a #rrggbb hex value", () => {
    const result = createClassTypeSchema.safeParse({ ...base, color: "blue" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid #rrggbb hex color", () => {
    const result = createClassTypeSchema.parse({ ...base, color: "#1a2b3c" });
    expect(result.color).toBe("#1a2b3c");
  });
});
