import { describe, expect, it } from "vitest";
import { createClassTypeSchema, createMemberSchema } from "./validation";

// Locks the request-validator behaviour the API error envelope relies on,
// across the Zod major version in use.

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    const result = createMemberSchema.safeParse({ name: "Jo", email: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path[0] === "email")).toBe(true);
    }
  });

  it("trims and lower-cases a valid padded, mixed-case email", () => {
    const result = createMemberSchema.safeParse({ name: "Jo", email: " Foo@BAR.com " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("foo@bar.com");
    }
  });

  it("defaults a new member's status to active when omitted", () => {
    const result = createMemberSchema.parse({ name: "Jo", email: "jo@example.com" });
    expect(result.status).toBe("active");
  });
});

describe("createClassTypeSchema", () => {
  const base = { name: "Yoga", defaultCapacity: 12, defaultPriceCents: 1500 };

  it("rejects a colour that is not a #rrggbb hex value", () => {
    expect(createClassTypeSchema.safeParse({ ...base, color: "red" }).success).toBe(false);
    expect(createClassTypeSchema.safeParse({ ...base, color: "#fff" }).success).toBe(false);
    expect(createClassTypeSchema.safeParse({ ...base, color: "#12345" }).success).toBe(false);
    expect(createClassTypeSchema.safeParse({ ...base, color: "#1234567" }).success).toBe(false);
  });

  it("accepts a valid #rrggbb hex colour", () => {
    const result = createClassTypeSchema.safeParse({ ...base, color: "#a1B2c3" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBe("#a1B2c3");
    }
  });
});
