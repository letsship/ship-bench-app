import { describe, expect, it } from "vitest";

import {
  createClassTypeSchema,
  createMemberSchema,
  updateMemberSchema,
} from "./validation";

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    const result = createMemberSchema.safeParse({ name: "Ada", email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("trims and lower-cases a valid email", () => {
    const result = createMemberSchema.safeParse({ name: "Ada", email: " Foo@Bar.COM " });
    expect(result.success).toBe(true);
    expect(result.success && result.data.email).toBe("foo@bar.com");
  });

  it("defaults status to active when omitted", () => {
    const result = createMemberSchema.parse({ name: "Ada", email: "ada@example.com" });
    expect(result.status).toBe("active");
  });
});

describe("updateMemberSchema", () => {
  it("rejects a malformed email", () => {
    expect(updateMemberSchema.safeParse({ email: "nope" }).success).toBe(false);
  });

  it("trims and lower-cases a valid email", () => {
    const result = updateMemberSchema.safeParse({ email: " Foo@Bar.COM " });
    expect(result.success).toBe(true);
    expect(result.success && result.data.email).toBe("foo@bar.com");
  });
});

describe("hex color validation", () => {
  const base = { name: "Yoga", defaultCapacity: 10, defaultPriceCents: 1500 };

  it("rejects a colour that is not a #rrggbb hex value", () => {
    expect(createClassTypeSchema.safeParse({ ...base, color: "red" }).success).toBe(false);
    expect(createClassTypeSchema.safeParse({ ...base, color: "#12345" }).success).toBe(false);
    expect(createClassTypeSchema.safeParse({ ...base, color: "#1234567" }).success).toBe(
      false,
    );
  });

  it("accepts a valid #rrggbb hex colour", () => {
    const result = createClassTypeSchema.safeParse({ ...base, color: "#a1B2c3" });
    expect(result.success).toBe(true);
  });
});
