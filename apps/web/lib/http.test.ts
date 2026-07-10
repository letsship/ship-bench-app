import { describe, expect, it } from "vitest";
import { handle } from "./http";
import { createMemberSchema } from "./validation";

describe("handle", () => {
  it("returns a 400 bad_request envelope with field errors for a ZodError", async () => {
    const response = await handle(async () => {
      createMemberSchema.parse({ name: "Ada", email: "not-an-email" });
      throw new Error("unreachable");
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(body.error.details).toEqual([{ path: ["email"], message: expect.any(String) }]);
  });
});
