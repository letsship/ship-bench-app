import { describe, expect, it } from "vitest";
import { createClassTypeSchema, createMemberSchema } from "./validation";

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    expect(() =>
      createMemberSchema.parse({
        name: "John Doe",
        email: "not-an-email",
      }),
    ).toThrow();
  });

  it("accepts a valid email with surrounding whitespace and uppercase, returning it trimmed and lower-cased", () => {
    const result = createMemberSchema.parse({
      name: "John Doe",
      email: "  JOHN.DOE@EXAMPLE.COM  ",
    });

    expect(result.email).toBe("john.doe@example.com");
  });

  it("defaults status to active when not provided", () => {
    const result = createMemberSchema.parse({
      name: "John Doe",
      email: "john@example.com",
    });

    expect(result.status).toBe("active");
  });
});

describe("createClassTypeSchema", () => {
  it("rejects a color that is not a #rrggbb hex value", () => {
    expect(() =>
      createClassTypeSchema.parse({
        name: "Yoga",
        defaultCapacity: 20,
        defaultPriceCents: 1000,
        color: "not-a-hex",
      }),
    ).toThrow();
  });

  it("accepts a valid #rrggbb hex color", () => {
    const result = createClassTypeSchema.parse({
      name: "Yoga",
      defaultCapacity: 20,
      defaultPriceCents: 1000,
      color: "#FF5733",
    });

    expect(result.color).toBe("#FF5733");
  });
});
