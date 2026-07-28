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
      email: "  Ada.Wong@Example.COM ",
    });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("ada.wong@example.com");
  });

  it("defaults a new member's status to active", () => {
    const result = createMemberSchema.parse({ name: "Ada", email: "ada@example.com" });
    expect(result.status).toBe("active");
  });
});

describe("createClassTypeSchema", () => {
  const base = { name: "Yoga", defaultCapacity: 10, defaultPriceCents: 2000 };

  it("rejects a color that is not a #rrggbb hex value", () => {
    expect(createClassTypeSchema.safeParse({ ...base, color: "red" }).success).toBe(false);
    expect(createClassTypeSchema.safeParse({ ...base, color: "#12345" }).success).toBe(false);
    expect(createClassTypeSchema.safeParse({ ...base, color: "#1234567" }).success).toBe(
      false,
    );
  });

  it("accepts a valid #rrggbb hex color", () => {
    const result = createClassTypeSchema.safeParse({ ...base, color: "#1a2B3c" });
    expect(result.success).toBe(true);
  });
});
