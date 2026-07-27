import { describe, expect, it } from "vitest";
import { createClassTypeSchema, createMemberSchema } from "./validation";

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    const result = createMemberSchema.safeParse({ name: "Jane", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("trims and lower-cases a valid email", () => {
    const result = createMemberSchema.parse({ name: "Jane", email: " Foo@BAR.com " });
    expect(result.email).toBe("foo@bar.com");
  });

  it("defaults status to active when omitted", () => {
    const result = createMemberSchema.parse({ name: "Jane", email: "jane@example.com" });
    expect(result.status).toBe("active");
  });
});

describe("createClassTypeSchema", () => {
  it("rejects a colour that is not a #rrggbb hex value", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
      color: "blue",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid #rrggbb hex colour", () => {
    const result = createClassTypeSchema.parse({
      name: "Yoga",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
      color: "#a1b2c3",
    });
    expect(result.color).toBe("#a1b2c3");
  });
});
