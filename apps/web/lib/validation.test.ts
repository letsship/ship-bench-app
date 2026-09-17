import { describe, expect, it } from "vitest";
import {
  createClassTypeSchema,
  createMemberSchema,
  updateClassTypeSchema,
  updateMemberSchema,
} from "./validation";

const classTypeInput = {
  name: "Yoga",
  defaultCapacity: 20,
  defaultPriceCents: 1500,
};

describe("member schemas", () => {
  it("rejects malformed email addresses", () => {
    expect(() => createMemberSchema.parse({ name: "Ada", email: "not-an-email" })).toThrow();
    expect(() => updateMemberSchema.parse({ email: "not-an-email" })).toThrow();
  });

  it("trims and lower-cases email addresses", () => {
    expect(createMemberSchema.parse({ name: "Ada", email: "  ADA@EXAMPLE.COM  " }).email).toBe(
      "ada@example.com",
    );
    expect(updateMemberSchema.parse({ email: "  ADA@EXAMPLE.COM  " }).email).toBe(
      "ada@example.com",
    );
  });

  it("defaults new members to active", () => {
    expect(createMemberSchema.parse({ name: "Ada", email: "ada@example.com" }).status).toBe(
      "active",
    );
  });
});

describe("class type schemas", () => {
  it("rejects colors that are not #rrggbb hex values", () => {
    expect(() => createClassTypeSchema.parse({ ...classTypeInput, color: "red" })).toThrow();
    expect(() => updateClassTypeSchema.parse({ color: "#12345g" })).toThrow();
  });

  it("accepts #rrggbb hex values", () => {
    expect(createClassTypeSchema.parse({ ...classTypeInput, color: "#12aBcF" }).color).toBe(
      "#12aBcF",
    );
    expect(updateClassTypeSchema.parse({ color: "#123456" }).color).toBe("#123456");
  });
});
