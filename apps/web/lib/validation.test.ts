import { describe, expect, it } from "vitest";
import { createMemberSchema, updateMemberSchema, createClassTypeSchema } from "./validation";

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    expect(() =>
      createMemberSchema.parse({
        name: "John Doe",
        email: "not-an-email",
        status: "active",
      }),
    ).toThrow();
  });

  it("trims and lower-cases a valid email", () => {
    const result = createMemberSchema.parse({
      name: "John Doe",
      email: "  Foo@Bar.COM  ",
    });
    expect(result.email).toBe("foo@bar.com");
  });

  it("defaults status to 'active' when omitted", () => {
    const result = createMemberSchema.parse({
      name: "John Doe",
      email: "foo@bar.com",
    });
    expect(result.status).toBe("active");
  });
});

describe("updateMemberSchema", () => {
  it("rejects a malformed email when provided", () => {
    expect(() =>
      updateMemberSchema.parse({
        email: "not-an-email",
      }),
    ).toThrow();
  });

  it("trims and lower-cases a valid email", () => {
    const result = updateMemberSchema.parse({
      email: "  Foo@Bar.COM  ",
    });
    expect(result.email).toBe("foo@bar.com");
  });
});

describe("createClassTypeSchema", () => {
  it("rejects a color that is not a #rrggbb hex value", () => {
    expect(() =>
      createClassTypeSchema.parse({
        name: "Pilates",
        defaultCapacity: 10,
        defaultPriceCents: 1000,
        color: "red",
      }),
    ).toThrow();
  });

  it("rejects a color with wrong hex format", () => {
    expect(() =>
      createClassTypeSchema.parse({
        name: "Pilates",
        defaultCapacity: 10,
        defaultPriceCents: 1000,
        color: "#GGGGGG",
      }),
    ).toThrow();
  });

  it("rejects a color with incorrect length", () => {
    expect(() =>
      createClassTypeSchema.parse({
        name: "Pilates",
        defaultCapacity: 10,
        defaultPriceCents: 1000,
        color: "#FF00",
      }),
    ).toThrow();
  });

  it("accepts a valid #rrggbb hex color", () => {
    const result = createClassTypeSchema.parse({
      name: "Pilates",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
      color: "#FF5733",
    });
    expect(result.color).toBe("#FF5733");
  });

  it("accepts lowercase hex colors", () => {
    const result = createClassTypeSchema.parse({
      name: "Pilates",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
      color: "#ff5733",
    });
    expect(result.color).toBe("#ff5733");
  });
});
