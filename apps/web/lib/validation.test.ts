import { describe, it, expect } from "vitest";
import { createMemberSchema, updateMemberSchema, createClassTypeSchema } from "@/lib/validation";

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    const result = createMemberSchema.safeParse({
      name: "John Doe",
      email: "not-an-email",
      status: "active",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid email and trims and lowercases it", () => {
    const result = createMemberSchema.safeParse({
      name: "John Doe",
      email: "  JANE.DOE@EXAMPLE.COM  ",
      status: "active",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("jane.doe@example.com");
    }
  });

  it("defaults status to 'active' when not provided", () => {
    const result = createMemberSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
    }
  });
});

describe("updateMemberSchema", () => {
  it("accepts partial updates with a valid trimmed and lowercased email", () => {
    const result = updateMemberSchema.safeParse({
      email: "  UPDATED@EXAMPLE.COM  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("updated@example.com");
    }
  });

  it("rejects a malformed email", () => {
    const result = updateMemberSchema.safeParse({
      email: "invalid-email",
    });
    expect(result.success).toBe(false);
  });
});

describe("createClassTypeSchema", () => {
  it("rejects a color that is not #rrggbb", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
      color: "#fff",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid #rrggbb hex color", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
      color: "#FF5500",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBe("#FF5500");
    }
  });

  it("accepts a valid lowercase #rrggbb hex color", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
      color: "#ff5500",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBe("#ff5500");
    }
  });

  it("accepts without a color", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
    });
    expect(result.success).toBe(true);
  });
});
