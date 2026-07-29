import { describe, expect, it } from "vitest";
import { createClassTypeSchema, createMemberSchema } from "./validation";

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    const result = createMemberSchema.safeParse({
      name: "Ada",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("trims and lower-cases a valid email", () => {
    const result = createMemberSchema.safeParse({
      name: "Ada",
      email: " Foo@Bar.COM ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("foo@bar.com");
    }
  });

  it("defaults status to active when omitted", () => {
    const result = createMemberSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
    }
  });

  it("accepts an explicit status", () => {
    const result = createMemberSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      status: "paused",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("paused");
    }
  });
});

describe("createClassTypeSchema color (hexColor)", () => {
  it("rejects a color that is not a #rrggbb hex value", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      color: "red",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a short hex value", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      color: "#fff",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid #rrggbb hex value", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      color: "#1a2B3c",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBe("#1a2B3c");
    }
  });

  it("allows color to be omitted", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
    });
    expect(result.success).toBe(true);
  });
});
