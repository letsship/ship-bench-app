import { describe, expect, it } from "vitest";
import {
  createMemberSchema,
  createClassTypeSchema,
  createSessionSchema,
} from "./validation";

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    const result = createMemberSchema.safeParse({
      name: "Alice",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("trims and lower-cases a valid email", () => {
    const result = createMemberSchema.parse({
      name: "Alice",
      email: "  Foo@Bar.COM  ",
    });
    expect(result.email).toBe("foo@bar.com");
  });

  it("defaults status to 'active' when omitted", () => {
    const result = createMemberSchema.parse({
      name: "Alice",
      email: "alice@example.com",
    });
    expect(result.status).toBe("active");
  });

  it("accepts an explicit status", () => {
    const result = createMemberSchema.parse({
      name: "Alice",
      email: "alice@example.com",
      status: "paused",
    });
    expect(result.status).toBe("paused");
  });
});

describe("createClassTypeSchema", () => {
  it("rejects a non-#rrggbb hex color", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      description: "Morning yoga",
      color: "red",
      defaultCapacity: 20,
      defaultPriceCents: 1500,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid hex color", () => {
    const result = createClassTypeSchema.parse({
      name: "Yoga",
      description: "Morning yoga",
      color: "#aabbcc",
      defaultCapacity: 20,
      defaultPriceCents: 1500,
    });
    expect(result.color).toBe("#aabbcc");
  });

  it("accepts missing optional color", () => {
    const result = createClassTypeSchema.parse({
      name: "Yoga",
      defaultCapacity: 20,
      defaultPriceCents: 1500,
    });
    expect(result.color).toBeUndefined();
  });
});

describe("createSessionSchema", () => {
  it("rejects endsAt before startsAt", () => {
    const result = createSessionSchema.safeParse({
      classTypeId: "ct_1",
      instructor: "Bob",
      startsAt: "2025-06-02T10:00:00Z",
      endsAt: "2025-06-02T09:00:00Z",
      capacity: 20,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("endsAt"))).toBe(
        true,
      );
    }
  });

  it("accepts endsAt after startsAt", () => {
    const result = createSessionSchema.parse({
      classTypeId: "ct_1",
      instructor: "Bob",
      startsAt: "2025-06-02T09:00:00Z",
      endsAt: "2025-06-02T10:00:00Z",
      capacity: 20,
    });
    expect(result.endsAt).toBe("2025-06-02T10:00:00Z");
  });
});