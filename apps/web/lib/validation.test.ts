import { describe, expect, it } from "vitest";
import { createClassTypeSchema, createMemberSchema } from "./validation";

describe("validation schemas", () => {
  describe("createMemberSchema", () => {
    it("rejects a malformed email", () => {
      const result = createMemberSchema.safeParse({
        name: "John Doe",
        email: "invalid-email",
        status: "active",
      });
      expect(result.success).toBe(false);
    });

    it("trims and lower-cases a valid whitespace-padded, mixed-case email", () => {
      const result = createMemberSchema.safeParse({
        name: "Jane Doe",
        email: "  JANE.DOE@EXAMPLE.COM  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("jane.doe@example.com");
      }
    });

    it("defaults status to active when omitted", () => {
      const result = createMemberSchema.safeParse({
        name: "Bob Smith",
        email: "bob@example.com",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("active");
      }
    });
  });

  describe("createClassTypeSchema", () => {
    it("rejects a color that is not #rrggbb hex", () => {
      const result = createClassTypeSchema.safeParse({
        name: "Yoga",
        defaultCapacity: 10,
        defaultPriceCents: 1500,
        color: "red",
      });
      expect(result.success).toBe(false);
    });

    it("accepts a valid #rrggbb hex color", () => {
      const result = createClassTypeSchema.safeParse({
        name: "Yoga",
        defaultCapacity: 10,
        defaultPriceCents: 1500,
        color: "#ff5733",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.color).toBe("#ff5733");
      }
    });
  });
});
