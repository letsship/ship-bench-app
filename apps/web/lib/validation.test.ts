import { describe, expect, it } from "vitest";
import { createClassTypeSchema, createMemberSchema, updateMemberSchema } from "./validation";

// These lock in the request-validator behavior that must survive the Zod 4
// upgrade: email normalization order, the status default, and the hex color.

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    const result = createMemberSchema.safeParse({ name: "Ada", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects an email that is only whitespace", () => {
    const result = createMemberSchema.safeParse({ name: "Ada", email: "   " });
    expect(result.success).toBe(false);
  });

  it("trims and lower-cases a valid email", () => {
    const parsed = createMemberSchema.parse({ name: "Ada", email: " Foo@Bar.COM " });
    expect(parsed.email).toBe("foo@bar.com");
  });

  it("defaults status to active", () => {
    const parsed = createMemberSchema.parse({ name: "Ada", email: "ada@example.com" });
    expect(parsed.status).toBe("active");
  });

  it("keeps an explicit status", () => {
    const parsed = createMemberSchema.parse({
      name: "Ada",
      email: "ada@example.com",
      status: "paused",
    });
    expect(parsed.status).toBe("paused");
  });

  it("rejects an unknown status", () => {
    const result = createMemberSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      status: "archived",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateMemberSchema", () => {
  it("normalizes an optional email the same way", () => {
    const parsed = updateMemberSchema.parse({ email: " Foo@Bar.COM " });
    expect(parsed.email).toBe("foo@bar.com");
  });

  it("leaves email undefined when omitted", () => {
    const parsed = updateMemberSchema.parse({ name: "Ada" });
    expect(parsed.email).toBeUndefined();
  });
});

describe("createClassTypeSchema", () => {
  const base = { name: "Vinyasa", defaultCapacity: 12, defaultPriceCents: 1500 };

  it("accepts a #rrggbb hex color", () => {
    const parsed = createClassTypeSchema.parse({ ...base, color: "#1A2b3C" });
    expect(parsed.color).toBe("#1A2b3C");
  });

  it("rejects a color that is not #rrggbb", () => {
    for (const color of ["#fff", "1a2b3c", "rebeccapurple", "#1a2b3c4"]) {
      expect(createClassTypeSchema.safeParse({ ...base, color }).success).toBe(false);
    }
  });

  it("allows the color to be omitted", () => {
    const parsed = createClassTypeSchema.parse(base);
    expect(parsed.color).toBeUndefined();
  });
});
