import { describe, expect, it } from "vitest";
import { createClassTypeSchema, createMemberSchema } from "./validation";

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    const result = createMemberSchema.safeParse({ name: "Ada", email: "not-an-email" });

    expect(result.success).toBe(false);
  });

  it("trims and lower-cases a valid email", () => {
    const result = createMemberSchema.safeParse({
      name: "Ada",
      email: "  USER@Example.COM ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("defaults status to active", () => {
    const result = createMemberSchema.safeParse({ name: "Ada", email: "ada@example.com" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
    }
  });
});

describe("createClassTypeSchema", () => {
  it("rejects a color that is not a #rrggbb hex value", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      color: "blue",
      defaultCapacity: 12,
      defaultPriceCents: 2500,
    });

    expect(result.success).toBe(false);
  });
});
