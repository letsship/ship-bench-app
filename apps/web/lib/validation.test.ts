import { describe, expect, it } from "vitest";

import {
  createClassTypeSchema,
  createMemberSchema,
  updateClassTypeSchema,
  updateMemberSchema,
} from "./validation";

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    const result = createMemberSchema.safeParse({ name: "Jane", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("trims and lower-cases a valid mixed-case, padded email", () => {
    const result = createMemberSchema.parse({
      name: "Jane",
      email: "  Jane@Example.COM  ",
    });
    expect(result.email).toBe("jane@example.com");
  });

  it("defaults a new member's status to active", () => {
    const result = createMemberSchema.parse({ name: "Jane", email: "jane@example.com" });
    expect(result.status).toBe("active");
  });

  it("accepts an explicitly provided status", () => {
    const result = createMemberSchema.parse({
      name: "Jane",
      email: "jane@example.com",
      status: "paused",
    });
    expect(result.status).toBe("paused");
  });
});

describe("updateMemberSchema", () => {
  it("trims and lower-cases a valid email when provided", () => {
    const result = updateMemberSchema.parse({ email: "  Jane@Example.COM  " });
    expect(result.email).toBe("jane@example.com");
  });

  it("rejects a malformed email", () => {
    const result = updateMemberSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("makes every field optional", () => {
    const result = updateMemberSchema.parse({});
    expect(result).toEqual({});
  });
});

describe("createClassTypeSchema color", () => {
  it("accepts a valid #rrggbb hex color", () => {
    const result = createClassTypeSchema.parse({
      name: "Yoga",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
      color: "#AaBbCc",
    });
    expect(result.color).toBe("#AaBbCc");
  });

  it("rejects a color that is not a #rrggbb hex value", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
      color: "#XYZ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a short color", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
      color: "#abc",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateClassTypeSchema color", () => {
  it("accepts a valid #rrggbb hex color", () => {
    const result = updateClassTypeSchema.parse({ color: "#1a2B3c" });
    expect(result.color).toBe("#1a2B3c");
  });

  it("rejects a colour that is not a #rrggbb hex value", () => {
    const result = updateClassTypeSchema.safeParse({ color: "red" });
    expect(result.success).toBe(false);
  });
});
