import { describe, expect, it } from "vitest";
import { handle } from "./http";
import { createClassTypeSchema, createMemberSchema } from "./validation";

const validMember = {
  name: "Ada Lovelace",
  email: "ada@example.com",
};

const validClassType = {
  name: "Morning Flow",
  defaultCapacity: 20,
  defaultPriceCents: 2500,
};

describe("createMemberSchema", () => {
  it("rejects malformed email addresses", () => {
    expect(createMemberSchema.safeParse({ ...validMember, email: "not-an-email" }).success).toBe(
      false,
    );
  });

  it("trims and lower-cases valid email addresses", () => {
    const member = createMemberSchema.parse({
      ...validMember,
      email: "  Ada.Lovelace@Example.COM  ",
    });

    expect(member.email).toBe("ada.lovelace@example.com");
  });

  it("defaults status to active", () => {
    expect(createMemberSchema.parse(validMember).status).toBe("active");
  });
});

describe("createClassTypeSchema", () => {
  it.each(["red", "#fff"])("rejects invalid hex color %s", (color) => {
    expect(createClassTypeSchema.safeParse({ ...validClassType, color }).success).toBe(false);
  });

  it("accepts a #rrggbb hex color", () => {
    expect(createClassTypeSchema.safeParse({ ...validClassType, color: "#12aBcF" }).success).toBe(
      true,
    );
  });
});

describe("handle", () => {
  it("returns the validation error envelope from Zod issues", async () => {
    const response = await handle(async () => {
      createMemberSchema.parse({ ...validMember, email: "not-an-email" });
      return new Response();
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "bad_request",
        message: "Validation failed",
        details: [{ path: ["email"], message: expect.any(String) }],
      },
    });
  });
});
