import { describe, expect, it } from "vitest";
import { handle } from "./http";
import { createMemberSchema } from "./validation";

describe("handle", () => {
  it("maps Zod validation errors to the bad-request envelope", async () => {
    const response = await handle(async () => {
      createMemberSchema.parse({ name: "Ada Lovelace", email: "not-an-email" });
      return new Response(null, { status: 204 });
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "bad_request",
        message: "Validation failed",
        details: [{ path: ["email"], message: "Invalid email address" }],
      },
    });
  });
});
