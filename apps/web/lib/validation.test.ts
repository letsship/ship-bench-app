import { describe, expect, it } from "vitest";
import { createClassTypeSchema, createMemberSchema, updateMemberSchema } from "./validation";

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    const result = createMemberSchema.safeParse({ name: "Ada", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("trims and lower-cases a valid email", () => {
    const result = createMemberSchema.parse({ name: "Ada", email: "  Foo@Bar.COM " });
    expect(result.email).toBe("foo@bar.com");
  });

  it("trims and lower-cases before checking the email format", () => {
    // A padded, mixed-case address is valid once normalised — the transforms
    // must run before the format check, not after.
    expect(createMemberSchema.safeParse({ name: "Ada", email: " ADA@Example.COM " }).success).toBe(
      true,
    );
  });

  it("defaults status to active when omitted", () => {
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

  it("rejects an unknown status", () => {
    const result = createMemberSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      status: "archived",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(createMemberSchema.safeParse({ name: "   ", email: "ada@example.com" }).success).toBe(
      false,
    );
  });
});

describe("updateMemberSchema", () => {
  it("leaves email absent when not supplied", () => {
    const result = updateMemberSchema.parse({ name: "Ada" });
    expect(result.email).toBeUndefined();
  });

  it("trims and lower-cases a supplied email", () => {
    const result = updateMemberSchema.parse({ email: " Ada@EXAMPLE.com " });
    expect(result.email).toBe("ada@example.com");
  });

  it("rejects a malformed email", () => {
    expect(updateMemberSchema.safeParse({ email: "nope@" }).success).toBe(false);
  });
});

describe("createClassTypeSchema", () => {
  const base = { name: "Reformer", defaultCapacity: 8, defaultPriceCents: 2500 };

  it("accepts a #rrggbb hex colour", () => {
    const result = createClassTypeSchema.parse({ ...base, color: "#1A2b3C" });
    expect(result.color).toBe("#1A2b3C");
  });

  it("rejects a colour that is not a #rrggbb hex value", () => {
    expect(createClassTypeSchema.safeParse({ ...base, color: "red" }).success).toBe(false);
  });

  it("rejects a three-digit shorthand hex colour", () => {
    expect(createClassTypeSchema.safeParse({ ...base, color: "#abc" }).success).toBe(false);
  });

  it("rejects a hex colour without the leading hash", () => {
    expect(createClassTypeSchema.safeParse({ ...base, color: "1a2b3c" }).success).toBe(false);
  });

  it("allows the colour to be omitted", () => {
    expect(createClassTypeSchema.parse(base).color).toBeUndefined();
  });
});
