import { describe, it, expect } from "vitest";
import { createMemberSchema, createClassTypeSchema } from "./validation";

describe("validation", () => {
  describe("createMemberSchema", () => {
    it("rejects malformed email", () => {
      const result = createMemberSchema.safeParse({
        name: "John Doe",
        email: "not-an-email",
        status: "active",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.includes("email"))).toBe(true);
      }
    });

    it("trims and lower-cases valid email", () => {
      const result = createMemberSchema.safeParse({
        name: "John Doe",
        email: "  JohnDoe@Example.COM  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("johndoe@example.com");
      }
    });

    it("defaults status to active when omitted", () => {
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
    it("rejects non-hex color", () => {
      const result = createClassTypeSchema.safeParse({
        name: "Yoga",
        defaultCapacity: 10,
        defaultPriceCents: 1000,
        color: "invalid-color",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.includes("color"))).toBe(true);
      }
    });

    it("accepts valid hex color", () => {
      const result = createClassTypeSchema.safeParse({
        name: "Yoga",
        defaultCapacity: 10,
        defaultPriceCents: 1000,
        color: "#FF5733",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.color).toBe("#FF5733");
      }
    });

    it("accepts missing optional color", () => {
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
});
