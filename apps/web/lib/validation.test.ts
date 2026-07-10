import { describe, expect, it } from "vitest";
import { createClassTypeSchema, createMemberSchema, updateMemberSchema } from "./validation";

describe("createMemberSchema email", () => {
  it("rejects a malformed email", () => {
    expect(() => createMemberSchema.parse({ name: "Ada", email: "not-an-email" })).toThrow();
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

describe("updateMemberSchema email", () => {
  it("rejects a malformed email", () => {
    expect(() => updateMemberSchema.parse({ email: "not-an-email" })).toThrow();
  });

  it("trims and lower-cases a valid email", () => {
    const result = updateMemberSchema.parse({ email: "  Ada@Example.COM  " });
    expect(result.email).toBe("ada@example.com");
  });
});

describe("createClassTypeSchema color", () => {
  it("accepts a valid #rrggbb hex color", () => {
    const result = createClassTypeSchema.parse({
      name: "Yoga",
      color: "#a1b2c3",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
    });
    expect(result.color).toBe("#a1b2c3");
  });

  it("rejects a color that is not a #rrggbb hex value", () => {
    expect(() =>
      createClassTypeSchema.parse({
        name: "Yoga",
        color: "red",
        defaultCapacity: 10,
        defaultPriceCents: 1000,
      }),
    ).toThrow();
  });
});
