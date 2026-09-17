import { describe, expect, it } from "vitest";
import { z } from "zod";
import { handle } from "./http";

describe("handle", () => {
  it("returns Zod issues in the validation error envelope", async () => {
    const response = await handle(async () => {
      z.object({ email: z.email() }).parse({ email: "not-an-email" });
      return new Response();
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
