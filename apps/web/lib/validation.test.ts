import { describe, expect, it } from "vitest";
import { createClassTypeSchema, createMemberSchema } from "./validation";

const validClassType = {
  name: "Vinyasa",
  defaultCapacity: 12,
  defaultPriceCents: 1800,
};

describe("request validation schemas", () => {
  it("rejects malformed member emails", () => {
    const result = createMemberSchema.safeParse({
      name: "Amara",
      email: "not-an-email",
    });

    expect(result.success).toBe(false);
  });

  it("trims and lower-cases valid member emails before validating them", () => {
    const result = createMemberSchema.parse({
      name: "Amara",
      email: "  Amara@Example.COM  ",
    });

    expect(result.email).toBe("amara@example.com");
  });

  it("defaults a new member's status to active", () => {
    const result = createMemberSchema.parse({
      name: "Amara",
      email: "amara@example.com",
    });

    expect(result.status).toBe("active");
  });

  it("requires class type colors to use the #rrggbb format", () => {
    expect(
      createClassTypeSchema.safeParse({ ...validClassType, color: "blue" }).success,
    ).toBe(false);
    expect(
      createClassTypeSchema.safeParse({ ...validClassType, color: "#A1b2C3" }).success,
    ).toBe(true);
  });
});
