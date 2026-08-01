import { describe, expect, it } from "vitest";
import { createClassTypeSchema, createMemberSchema } from "./validation";

const validMember = {
  name: "Ada Lovelace",
  email: "ada@example.com",
};

const validClassType = {
  name: "Reformer Pilates",
  defaultCapacity: 12,
  defaultPriceCents: 2500,
};

describe("createMemberSchema", () => {
  it("rejects a malformed email", () => {
    expect(createMemberSchema.safeParse({ ...validMember, email: "not-an-email" }).success).toBe(
      false,
    );
  });

  it("trims and lower-cases a valid email before validation", () => {
    const member = createMemberSchema.parse({ ...validMember, email: "  A@B.COM " });

    expect(member.email).toBe("a@b.com");
  });

  it("defaults a new member's status to active", () => {
    const member = createMemberSchema.parse(validMember);

    expect(member.status).toBe("active");
  });
});

describe("createClassTypeSchema", () => {
  it("rejects invalid colors and accepts #rrggbb hex colors", () => {
    expect(createClassTypeSchema.safeParse({ ...validClassType, color: "red" }).success).toBe(
      false,
    );
    expect(createClassTypeSchema.safeParse({ ...validClassType, color: "#12aBcF" }).success).toBe(
      true,
    );
  });
});
