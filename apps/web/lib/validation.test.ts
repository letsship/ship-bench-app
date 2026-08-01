import { describe, expect, it } from "vitest";
import { createClassTypeSchema, createMemberSchema, updateMemberSchema } from "./validation";

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    const result = createMemberSchema.safeParse({ name: "Ada", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("trims and lower-cases a valid email", () => {
    const result = createMemberSchema.parse({ name: "Ada", email: "  Foo@Bar.com  " });
    expect(result.email).toBe("foo@bar.com");
  });

  it("defaults status to active", () => {
    const result = createMemberSchema.parse({ name: "Ada", email: "ada@example.com" });
    expect(result.status).toBe("active");
  });

  it("keeps an explicit status", () => {
    const result = createMemberSchema.parse({
      name: "Ada",
      email: "ada@example.com",
      status: "paused",
    });
    expect(result.status).toBe("paused");
  });
});

describe("updateMemberSchema", () => {
  it("rejects a malformed email", () => {
    const result = updateMemberSchema.safeParse({ email: "nope" });
    expect(result.success).toBe(false);
  });

  it("trims and lower-cases a valid email", () => {
    const result = updateMemberSchema.parse({ email: " Foo@Bar.com " });
    expect(result.email).toBe("foo@bar.com");
  });
});

describe("createClassTypeSchema", () => {
  const base = { name: "Yoga", defaultCapacity: 10, defaultPriceCents: 1500 };

  it("rejects a colour that is not a #rrggbb hex value", () => {
    const result = createClassTypeSchema.safeParse({ ...base, color: "red" });
    expect(result.success).toBe(false);
  });

  it("rejects a shorthand hex colour", () => {
    const result = createClassTypeSchema.safeParse({ ...base, color: "#fff" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid #rrggbb hex colour", () => {
    const result = createClassTypeSchema.parse({ ...base, color: "#A1b2C3" });
    expect(result.color).toBe("#A1b2C3");
  });
});
