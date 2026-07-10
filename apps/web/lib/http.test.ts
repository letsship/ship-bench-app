import { describe, expect, it } from "vitest";
import { createMemberSchema } from "./validation";
import { handle } from "./http";

describe("handle", () => {
  it("turns a ZodError from schema.parse into a bad_request envelope", async () => {
    const response = await handle(async () => {
      createMemberSchema.parse({ name: "Ada", email: "not-an-email" });
      throw new Error("unreachable");
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details[0]).toMatchObject({ path: ["email"] });
  });
});
