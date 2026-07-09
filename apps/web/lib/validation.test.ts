import { describe, expect, it } from "vitest";
import { createClassTypeSchema, createMemberSchema } from "./validation";

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    const result = createMemberSchema.safeParse({ name: "Jane", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("trims and lower-cases a valid email", () => {
    const result = createMemberSchema.parse({ name: "Jane", email: "  Foo@Bar.COM  " });
    expect(result.email).toBe("foo@bar.com");
  });

  it("defaults status to active when omitted", () => {
    const result = createMemberSchema.parse({ name: "Jane", email: "foo@bar.com" });
    expect(result.status).toBe("active");
  });
});

describe("createClassTypeSchema color", () => {
  it("rejects a color that is not #rrggbb hex", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
      color: "red",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid #rrggbb hex color", () => {
    const result = createClassTypeSchema.parse({
      name: "Yoga",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
      color: "#ff00aa",
    });
    expect(result.color).toBe("#ff00aa");
  });
});
