import { describe, expect, it } from "vitest";
import { createClassTypeSchema, createMemberSchema } from "./validation";

describe("createMemberSchema email", () => {
  it("rejects a malformed email", () => {
    expect(() => createMemberSchema.parse({ name: "Jane", email: "not-an-email" })).toThrow();
  });

  it("trims and lower-cases a valid email", () => {
    const result = createMemberSchema.parse({ name: "Jane", email: "  Foo@Bar.COM  " });
    expect(result.email).toBe("foo@bar.com");
  });
});

describe("createMemberSchema status", () => {
  it("defaults status to active when omitted", () => {
    const result = createMemberSchema.parse({ name: "Jane", email: "jane@example.com" });
    expect(result.status).toBe("active");
  });
});

describe("createClassTypeSchema color", () => {
  it("rejects a color that is not #rrggbb hex", () => {
    expect(() =>
      createClassTypeSchema.parse({
        name: "Yoga",
        color: "red",
        defaultCapacity: 10,
        defaultPriceCents: 1000,
      }),
    ).toThrow();
  });

  it("accepts a valid #rrggbb hex color", () => {
    const result = createClassTypeSchema.parse({
      name: "Yoga",
      color: "#1a2b3c",
      defaultCapacity: 10,
      defaultPriceCents: 1000,
    });
    expect(result.color).toBe("#1a2b3c");
  });
});
