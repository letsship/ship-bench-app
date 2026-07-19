import { describe, it, expect } from "vitest";
import { createMemberSchema, createClassTypeSchema } from "./validation";

describe("validation schemas", () => {
  describe("createMemberSchema", () => {
    it("rejects a malformed email", () => {
      const result = createMemberSchema.safeParse({
        name: "John Doe",
        email: "not-an-email",
        status: "active",
      });
      expect(result.success).toBe(false);
    });

    it("trims and lower-cases a valid email", () => {
      const result = createMemberSchema.safeParse({
        name: "John Doe",
        email: "  JOHN@EXAMPLE.COM  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("john@example.com");
      }
    });

    it("defaults status to 'active' when omitted", () => {
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

  describe("createClassTypeSchema", () => {
    it("rejects a color that is not a #rrggbb hex value", () => {
      const result = createClassTypeSchema.safeParse({
        name: "Yoga",
        defaultCapacity: 20,
        defaultPriceCents: 1500,
        color: "not-a-color",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a hex color without the # prefix", () => {
      const result = createClassTypeSchema.safeParse({
        name: "Yoga",
        defaultCapacity: 20,
        defaultPriceCents: 1500,
        color: "ff0000",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a hex color with invalid characters", () => {
      const result = createClassTypeSchema.safeParse({
        name: "Yoga",
        defaultCapacity: 20,
        defaultPriceCents: 1500,
        color: "#gggggg",
      });
      expect(result.success).toBe(false);
    });

    it("accepts a valid #rrggbb hex color", () => {
      const result = createClassTypeSchema.safeParse({
        name: "Yoga",
        defaultCapacity: 20,
        defaultPriceCents: 1500,
        color: "#ff0000",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.color).toBe("#ff0000");
      }
    });
  });
});
