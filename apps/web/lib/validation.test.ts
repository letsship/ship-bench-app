import { describe, expect, it } from "vitest";
import { createClassTypeSchema, createMemberSchema } from "./validation";

describe("createMemberSchema", () => {
  it("rejects malformed email addresses", () => {
    expect(() =>
      createMemberSchema.parse({ name: "Alex", email: "not-an-email" }),
    ).toThrow();
  });

  it("trims and lower-cases valid email addresses", () => {
    expect(
      createMemberSchema.parse({ name: "Alex", email: "  ALEX@EXAMPLE.COM  " }),
    ).toMatchObject({ email: "alex@example.com" });
  });

  it("defaults a new member status to active", () => {
    expect(createMemberSchema.parse({ name: "Alex", email: "alex@example.com" }).status).toBe(
      "active",
    );
  });
});

describe("createClassTypeSchema", () => {
  const validClassType = {
    name: "Pilates",
    defaultCapacity: 10,
    defaultPriceCents: 1500,
  };

  it("rejects colors that are not #rrggbb hex values", () => {
    expect(() =>
      createClassTypeSchema.parse({ ...validClassType, color: "blue" }),
    ).toThrow();
  });

  it("accepts a valid #rrggbb hex color", () => {
    expect(
      createClassTypeSchema.parse({ ...validClassType, color: "#12aBc9" }).color,
    ).toBe("#12aBc9");
  });
});
