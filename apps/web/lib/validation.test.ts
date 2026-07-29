import { describe, expect, it } from "vitest";
import { createClassTypeSchema, createMemberSchema } from "./validation";

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    const result = createMemberSchema.safeParse({
      name: "Ada Lovelace",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("trims and lower-cases a valid padded, mixed-case email", () => {
    const result = createMemberSchema.safeParse({
      name: "Ada Lovelace",
      email: " Foo@Bar.com ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("foo@bar.com");
    }
  });

  it("defaults a new member's status to active when omitted", () => {
    const result = createMemberSchema.safeParse({
      name: "Ada Lovelace",
      email: "ada@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
    }
  });

  it("preserves an explicitly provided status", () => {
    const result = createMemberSchema.safeParse({
      name: "Ada Lovelace",
      email: "ada@example.com",
      status: "paused",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("paused");
    }
  });
});

describe("createClassTypeSchema color", () => {
  it("rejects a color that is not a #rrggbb hex value", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
      color: "blue",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a 3-digit hex shorthand", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
      color: "#fff",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid #rrggbb hex value", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
      color: "#1a2B3c",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBe("#1a2B3c");
    }
  });

  it("accepts an omitted color", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBeUndefined();
    }
  });
});
