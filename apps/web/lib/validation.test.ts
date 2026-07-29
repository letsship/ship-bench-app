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

  it("trims and lower-cases a valid email with surrounding whitespace and mixed case", () => {
    const result = createMemberSchema.safeParse({
      name: "Ada Lovelace",
      email: "  Foo@BAR.com  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("foo@bar.com");
    }
  });

  it("defaults status to active when omitted", () => {
    const result = createMemberSchema.safeParse({
      name: "Ada Lovelace",
      email: "ada@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
    }
  });

  it("accepts an explicit status", () => {
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

describe("createClassTypeSchema", () => {
  const baseInput = {
    name: "Vinyasa",
    defaultCapacity: 10,
    defaultPriceCents: 1500,
  };

  it("rejects a color that is not a #rrggbb hex value", () => {
    const result = createClassTypeSchema.safeParse({ ...baseInput, color: "red" });
    expect(result.success).toBe(false);

    const short = createClassTypeSchema.safeParse({ ...baseInput, color: "#fff" });
    expect(short.success).toBe(false);
  });

  it("accepts a valid #rrggbb hex color", () => {
    const result = createClassTypeSchema.safeParse({ ...baseInput, color: "#1a2b3c" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBe("#1a2b3c");
    }
  });

  it("allows the color to be omitted", () => {
    const result = createClassTypeSchema.safeParse(baseInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBeUndefined();
    }
  });
});
