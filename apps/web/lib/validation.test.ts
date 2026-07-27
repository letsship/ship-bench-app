import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { createClassTypeSchema, createMemberSchema } from "./validation";

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    expect(() => createMemberSchema.parse({ name: "Ada Lovelace", email: "not-an-email" })).toThrow(
      ZodError,
    );
  });

  it("trims and lower-cases a valid email", () => {
    const result = createMemberSchema.parse({
      name: "Ada Lovelace",
      email: "  X@Y.COM ",
    });
    expect(result.email).toBe("x@y.com");
  });

  it("defaults status to active when omitted", () => {
    const result = createMemberSchema.parse({
      name: "Ada Lovelace",
      email: "ada@example.com",
    });
    expect(result.status).toBe("active");
  });
});

describe("createClassTypeSchema color", () => {
  it("rejects a color that is not a #rrggbb hex value", () => {
    expect(() =>
      createClassTypeSchema.parse({
        name: "Yoga",
        color: "blue",
        defaultCapacity: 10,
        defaultPriceCents: 1000,
      }),
    ).toThrow(ZodError);
  });

  it("accepts a valid #rrggbb hex value", () => {
    const result = createClassTypeSchema.parse({
      name: "Yoga",
      color: "#1a2b3c",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
    });
    expect(result.color).toBe("#1a2b3c");
  });
});
