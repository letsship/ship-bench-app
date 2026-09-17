import { describe, expect, it } from "vitest";
import { z } from "zod";
import { handle } from "./http";

describe("handle", () => {
  it("returns the validation error envelope from Zod issues", async () => {
    const result = z.object({ email: z.email() }).safeParse({ email: "not-an-email" });

    if (result.success) throw new Error("Expected invalid test input");

    const response = await handle(async () => {
      throw result.error;
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "bad_request",
        message: "Validation failed",
        details: result.error.issues.map((issue) => ({
          path: issue.path,
          message: issue.message,
        })),
      },
    });
  });
});
