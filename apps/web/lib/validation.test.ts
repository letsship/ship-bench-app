import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { createClassTypeSchema, createMemberSchema } from "./validation";

const validMember = {
  name: "Alex Morgan",
  email: "alex@example.com",
};

const validClassType = {
  name: "Morning Flow",
  defaultCapacity: 20,
  defaultPriceCents: 2500,
};

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    expect(() => createMemberSchema.parse({ ...validMember, email: "not-an-email" })).toThrow(
      ZodError,
    );
  });

  it("trims and lower-cases a valid email", () => {
    const member = createMemberSchema.parse({
      ...validMember,
      email: "  ALEX.MORGAN@EXAMPLE.COM  ",
    });

    expect(member.email).toBe("alex.morgan@example.com");
  });

  it("defaults status to active", () => {
    expect(createMemberSchema.parse(validMember).status).toBe("active");
  });
});

describe("createClassTypeSchema", () => {
  it("rejects a color that is not a #rrggbb hex value", () => {
    expect(() => createClassTypeSchema.parse({ ...validClassType, color: "blue" })).toThrow(
      ZodError,
    );
  });

  it("accepts a #rrggbb hex color", () => {
    expect(createClassTypeSchema.parse({ ...validClassType, color: "#1a2B3c" }).color).toBe(
      "#1a2B3c",
    );
  });
});
