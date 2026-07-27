import { describe, expect, it } from "vitest";
import { handle } from "./http";
import { createMemberSchema } from "./validation";

describe("handle", () => {
  it("turns a thrown ZodError into a 400 with the validation-error envelope", async () => {
    const response = await handle(async () => {
      createMemberSchema.parse({ name: "Ada Lovelace", email: "not-an-email" });
      throw new Error("unreachable");
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { code: string; message: string; details: unknown };
    };
    expect(body.error.code).toBe("bad_request");
    expect(body.error.message).toBe("Validation failed");
    expect(body.error.details).toEqual([{ path: ["email"], message: expect.any(String) }]);
  });
});
