import { describe, it, expect } from "vitest";
import { createMemberSchema, createClassTypeSchema } from "./validation";

describe("validation schemas", () => {
  describe("createMemberSchema", () => {
    it("rejects a malformed email", () => {
      const result = createMemberSchema.safeParse({
        name: "John Doe",
        email: "not-an-email",
        phone: "555-1234",
        status: "active",
      });
      expect(result.success).toBe(false);
    });

    it("trims and lowercases a valid mixed-case padded email", () => {
      const result = createMemberSchema.safeParse({
        name: "John Doe",
        email: "  JohnDoe@Example.COM  ",
        phone: "555-1234",
        status: "active",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("johndoe@example.com");
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
    it("rejects a color that is not #rrggbb format", () => {
      const result = createClassTypeSchema.safeParse({
        name: "Yoga",
        defaultCapacity: 20,
        defaultPriceCents: 5000,
        color: "red",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a color without # prefix", () => {
      const result = createClassTypeSchema.safeParse({
        name: "Yoga",
        defaultCapacity: 20,
        defaultPriceCents: 5000,
        color: "aabbcc",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a color with invalid hex digits", () => {
      const result = createClassTypeSchema.safeParse({
        name: "Yoga",
        defaultCapacity: 20,
        defaultPriceCents: 5000,
        color: "#gggggg",
      });
      expect(result.success).toBe(false);
    });

    it("accepts a valid #rrggbb hex color", () => {
      const result = createClassTypeSchema.safeParse({
        name: "Yoga",
        defaultCapacity: 20,
        defaultPriceCents: 5000,
        color: "#aabbcc",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.color).toBe("#aabbcc");
      }
    });

    it("accepts uppercase hex digits in #rrggbb format", () => {
      const result = createClassTypeSchema.safeParse({
        name: "Yoga",
        defaultCapacity: 20,
        defaultPriceCents: 5000,
        color: "#AABBCC",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.color).toBe("#AABBCC");
      }
    });
  });
});
