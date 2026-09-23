import { describe, expect, it } from "vitest";
import { handle } from "./http";
import { createMemberSchema } from "./validation";

describe("handle", () => {
  it("returns the validation error envelope for a ZodError", async () => {
    const response = await handle(async () => {
      createMemberSchema.parse({ name: "Ada", email: "not-an-email" });
      return new Response();
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "bad_request",
        message: "Validation failed",
        details: [{ path: ["email"], message: "Invalid email address" }],
      },
    });
  });
});
