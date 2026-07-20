import { describe, it, expect } from "vitest";
import { createMemberSchema, createClassTypeSchema } from "./validation";

describe("Validation schemas", () => {
  describe("createMemberSchema", () => {
    it("rejects a malformed email", () => {
      const result = createMemberSchema.safeParse({
        name: "John Doe",
        email: "not-an-email",
        status: "active",
      });
      expect(result.success).toBe(false);
    });

    it("trims and lowercases a valid email", () => {
      const result = createMemberSchema.safeParse({
        name: "John Doe",
        email: "  JOHN@EXAMPLE.COM  ",
        status: "active",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("john@example.com");
      }
    });

    it("defaults status to 'active' when not provided", () => {
      const result = createMemberSchema.safeParse({
        name: "Jane Doe",
        email: "jane@example.com",
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
        defaultCapacity: 10,
        defaultPriceCents: 1000,
        color: "not-a-hex",
      });
      expect(result.success).toBe(false);
    });

    it("accepts a valid #rrggbb hex color", () => {
      const result = createClassTypeSchema.safeParse({
        name: "Yoga",
        defaultCapacity: 10,
        defaultPriceCents: 1000,
        color: "#FF00AA",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.color).toBe("#FF00AA");
      }
    });

    it("accepts lowercase hex colors", () => {
      const result = createClassTypeSchema.safeParse({
        name: "Pilates",
        defaultCapacity: 15,
        defaultPriceCents: 2000,
        color: "#ff00aa",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.color).toBe("#ff00aa");
      }
    });
  });
});
